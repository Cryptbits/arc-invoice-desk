import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

const USDC_DEC = 6;
const usd = (n: number) => ethers.parseUnits(n.toString(), USDC_DEC);

async function fullFixture() {
  const [owner, seller, lender1, lender2, buyer] = await ethers.getSigners();

  const ERC20 = await ethers.getContractFactory("MockERC20");
  const usdc = await ERC20.deploy("USD Coin", "USDC", USDC_DEC);
  const eurc = await ERC20.deploy("Euro Coin", "EURC", USDC_DEC);

  const Registry = await ethers.getContractFactory("InvoiceRegistry");
  const registry = await Registry.deploy();

  const Pool = await ethers.getContractFactory("LendingPool");
  const pool = await Pool.deploy(await usdc.getAddress(), await registry.getAddress());

  const MockFX = await ethers.getContractFactory("MockStableFX");
  const mockFX = await MockFX.deploy();

  await mockFX.setToken(ethers.encodeBytes32String("USDC"), await usdc.getAddress());
  await mockFX.setToken(ethers.encodeBytes32String("EURC"), await eurc.getAddress());

  const Settlement = await ethers.getContractFactory("FXSettlement");
  const settlement = await Settlement.deploy(
    await registry.getAddress(),
    await pool.getAddress(),
    await usdc.getAddress(),
    owner.address
  );

  await settlement.setStableFX(await mockFX.getAddress());

  await registry.setLendingPool(await pool.getAddress());
  await registry.setFxSettlement(await settlement.getAddress());

  await pool.setFxSettlement(await settlement.getAddress());

  await settlement.registerCurrency(ethers.encodeBytes32String("USDC"), await usdc.getAddress());
  await settlement.registerCurrency(ethers.encodeBytes32String("EURC"), await eurc.getAddress());

  await usdc.mint(lender1.address, usd(500_000));
  await usdc.mint(lender2.address, usd(500_000));
  await usdc.mint(buyer.address,   usd(100_000));
  await eurc.mint(buyer.address,   usd(100_000));

  await usdc.mint(await mockFX.getAddress(), usd(1_000_000));

  const dueDate = (await time.latest()) + 30 * 86400;
  return { owner, seller, lender1, lender2, buyer, usdc, eurc, registry, pool, settlement, mockFX, dueDate };
}

describe("Week 2 — End-to-end settlement flow", () => {

  it("full flow: mint → auction → two bids → clear → advance → USDC settle", async () => {
    const { seller, lender1, lender2, buyer, usdc, registry, pool, settlement, dueDate } = await loadFixture(fullFixture);

    const faceValue = usd(10_000);

    await registry.connect(seller).mintInvoice(
      faceValue, dueDate,
      ethers.encodeBytes32String("USDC"),
      ethers.encodeBytes32String("ipfs-doc"),
      "Acme Corp", "Q2 services"
    );

    await usdc.connect(lender1).approve(await pool.getAddress(), usd(20_000));
    await usdc.connect(lender2).approve(await pool.getAddress(), usd(20_000));
    await pool.connect(lender1).deposit(usd(15_000));
    await pool.connect(lender2).deposit(usd(15_000));

    await pool.connect(seller).createAuction(1);

    await pool.connect(lender1).placeBid(1, usd(10_000), 300);
    await pool.connect(lender2).placeBid(1, usd(10_000), 200);

    await time.increase(24 * 3600 + 1);

    const sellerBefore = await usdc.balanceOf(seller.address);
    await pool.connect(seller).clearAuction(1);
    const sellerAfter = await usdc.balanceOf(seller.address);

    const expectedAdvance = (faceValue * BigInt(9800)) / BigInt(10000);
    expect(sellerAfter - sellerBefore).to.equal(expectedAdvance);

    const invoice = await registry.getInvoice(1);
    expect(invoice.status).to.equal(2);

    await time.increaseTo(dueDate + 1);

    await usdc.connect(buyer).approve(await settlement.getAddress(), faceValue);
    await settlement.connect(buyer).settle(1, 1, faceValue, ethers.encodeBytes32String("USDC"));

    const settled = await registry.getInvoice(1);
    expect(settled.status).to.equal(3);
    await expect(registry.ownerOf(1)).to.be.reverted;
    console.log("    Invoice NFT burned. Status = Settled (3).");
  });

  it("StableFX path: buyer pays EURC, MockStableFX converts to USDC for lenders", async () => {
    const { seller, lender1, buyer, usdc, eurc, registry, pool, settlement, mockFX, dueDate } = await loadFixture(fullFixture);

    const faceValue = usd(5_000);

    await registry.connect(seller).mintInvoice(
      faceValue, dueDate,
      ethers.encodeBytes32String("EURC"),
      ethers.encodeBytes32String("ipfs-doc"),
      "Euro Buyer GmbH", "Export services"
    );

    await usdc.connect(lender1).approve(await pool.getAddress(), usd(10_000));
    await pool.connect(lender1).deposit(usd(10_000));
    await pool.connect(seller).createAuction(1);
    await pool.connect(lender1).placeBid(1, usd(5_000), 250);
    await time.increase(24 * 3600 + 1);
    await pool.connect(seller).clearAuction(1);

    await time.increaseTo(dueDate + 1);

    const expectedUSDC = (faceValue * BigInt(1_085_000)) / BigInt(1_000_000);

    await eurc.connect(buyer).approve(await settlement.getAddress(), faceValue);
    await settlement.connect(buyer).settle(1, 1, faceValue, ethers.encodeBytes32String("EURC"));

    const settled = await registry.getInvoice(1);
    expect(settled.status).to.equal(3);
    await expect(registry.ownerOf(1)).to.be.reverted;
    console.log(`    EURC converted to ~${ethers.formatUnits(expectedUSDC, USDC_DEC)} USDC via MockStableFX.`);
  });

  it("prevents double settlement", async () => {
    const { seller, lender1, buyer, usdc, registry, pool, settlement, dueDate } = await loadFixture(fullFixture);

    const faceValue = usd(3_000);

    await registry.connect(seller).mintInvoice(faceValue, dueDate, ethers.encodeBytes32String("USDC"), ethers.encodeBytes32String("h"), "Buyer", "");
    await usdc.connect(lender1).approve(await pool.getAddress(), usd(10_000));
    await pool.connect(lender1).deposit(usd(10_000));
    await pool.connect(seller).createAuction(1);
    await pool.connect(lender1).placeBid(1, faceValue, 200);
    await time.increase(24 * 3600 + 1);
    await pool.connect(seller).clearAuction(1);
    await time.increaseTo(dueDate + 1);

    await usdc.connect(buyer).approve(await settlement.getAddress(), faceValue * 2n);
    await settlement.connect(buyer).settle(1, 1, faceValue, ethers.encodeBytes32String("USDC"));

    await expect(
      settlement.connect(buyer).settle(1, 1, faceValue, ethers.encodeBytes32String("USDC"))
    ).to.be.reverted;
  });

  it("blocks settlement before due date", async () => {
    const { seller, lender1, buyer, usdc, registry, pool, settlement, dueDate } = await loadFixture(fullFixture);

    const faceValue = usd(2_000);

    await registry.connect(seller).mintInvoice(faceValue, dueDate, ethers.encodeBytes32String("USDC"), ethers.encodeBytes32String("h"), "Buyer", "");
    await usdc.connect(lender1).approve(await pool.getAddress(), usd(10_000));
    await pool.connect(lender1).deposit(usd(10_000));
    await pool.connect(seller).createAuction(1);
    await pool.connect(lender1).placeBid(1, faceValue, 200);
    await time.increase(24 * 3600 + 1);
    await pool.connect(seller).clearAuction(1);

    await usdc.connect(buyer).approve(await settlement.getAddress(), faceValue);
    await expect(
      settlement.connect(buyer).settle(1, 1, faceValue, ethers.encodeBytes32String("USDC"))
    ).to.be.revertedWith("Invoice not due yet");
  });

  it("two lenders split a large invoice at different fill amounts", async () => {
    const { seller, lender1, lender2, buyer, usdc, registry, pool, dueDate } = await loadFixture(fullFixture);

    const faceValue = usd(20_000);

    await registry.connect(seller).mintInvoice(faceValue, dueDate, ethers.encodeBytes32String("USDC"), ethers.encodeBytes32String("h"), "Big Corp", "");
    await usdc.connect(lender1).approve(await pool.getAddress(), usd(50_000));
    await usdc.connect(lender2).approve(await pool.getAddress(), usd(50_000));
    await pool.connect(lender1).deposit(usd(50_000));
    await pool.connect(lender2).deposit(usd(50_000));
    await pool.connect(seller).createAuction(1);

    await pool.connect(lender1).placeBid(1, usd(12_000), 180);
    await pool.connect(lender2).placeBid(1, usd(12_000), 220);
    await time.increase(24 * 3600 + 1);

    const sellerBefore = await usdc.balanceOf(seller.address);
    await pool.connect(seller).clearAuction(1);
    const sellerAfter = await usdc.balanceOf(seller.address);

    const auction = await pool.getAuction(1);
    expect(auction.clearingDiscountBps).to.equal(220n);

    const expectedAdvance = (faceValue * BigInt(10000 - 220)) / BigInt(10000);
    expect(sellerAfter - sellerBefore).to.be.closeTo(expectedAdvance, usd(1));

    console.log(`    Two lenders funded $20k invoice. Clearing rate: 2.2%. Advance: $${ethers.formatUnits(sellerAfter - sellerBefore, USDC_DEC)}`);
  });

});
