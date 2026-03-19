import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { InvoiceRegistry, LendingPool } from "../typechain-types";

const USDC_DECIMALS = 6;
const ONE_USDC = ethers.parseUnits("1", USDC_DECIMALS);
const FACE_VALUE = ethers.parseUnits("10000", USDC_DECIMALS);
const CURRENCY_USDC = ethers.encodeBytes32String("USDC");
const DOC_HASH = ethers.encodeBytes32String("ipfs-hash-placeholder");

async function deployFixture() {
  const [owner, seller, lender1, lender2, buyer] = await ethers.getSigners();

  const MockERC20Factory = await ethers.getContractFactory("MockERC20");
  const usdc = await MockERC20Factory.deploy("USD Coin", "USDC", USDC_DECIMALS);
  await usdc.waitForDeployment();

  const RegistryFactory = await ethers.getContractFactory("InvoiceRegistry");
  const registry = (await RegistryFactory.deploy()) as InvoiceRegistry;
  await registry.waitForDeployment();

  const PoolFactory = await ethers.getContractFactory("LendingPool");
  const pool = (await PoolFactory.deploy(
    await usdc.getAddress(),
    await registry.getAddress()
  )) as LendingPool;
  await pool.waitForDeployment();

  await registry.setLendingPool(await pool.getAddress());

  const mintAmount = ethers.parseUnits("1000000", USDC_DECIMALS);
  await usdc.mint(lender1.address, mintAmount);
  await usdc.mint(lender2.address, mintAmount);
  await usdc.mint(buyer.address, mintAmount);

  const dueDate = (await time.latest()) + 30 * 24 * 60 * 60;

  return { owner, seller, lender1, lender2, buyer, usdc, registry, pool, dueDate };
}

describe("InvoiceRegistry", () => {

  it("mints an invoice NFT with correct metadata", async () => {
    const { seller, registry, dueDate } = await loadFixture(deployFixture);

    const tx = await registry.connect(seller).mintInvoice(
      FACE_VALUE,
      dueDate,
      CURRENCY_USDC,
      DOC_HASH,
      "Acme Corp",
      "Services Q2"
    );
    await tx.wait();

    const invoice = await registry.getInvoice(1);
    expect(invoice.seller).to.equal(seller.address);
    expect(invoice.faceValue).to.equal(FACE_VALUE);
    expect(invoice.buyerName).to.equal("Acme Corp");
    expect(invoice.status).to.equal(0);
    expect(await registry.ownerOf(1)).to.equal(seller.address);
  });

  it("tracks seller invoice list", async () => {
    const { seller, registry, dueDate } = await loadFixture(deployFixture);

    await registry.connect(seller).mintInvoice(FACE_VALUE, dueDate, CURRENCY_USDC, DOC_HASH, "Buyer A", "");
    await registry.connect(seller).mintInvoice(FACE_VALUE, dueDate, CURRENCY_USDC, DOC_HASH, "Buyer B", "");

    const ids = await registry.getSellerInvoices(seller.address);
    expect(ids.length).to.equal(2);
    expect(ids[0]).to.equal(1n);
    expect(ids[1]).to.equal(2n);
  });

  it("rejects zero face value", async () => {
    const { seller, registry, dueDate } = await loadFixture(deployFixture);

    await expect(
      registry.connect(seller).mintInvoice(0, dueDate, CURRENCY_USDC, DOC_HASH, "Buyer", "")
    ).to.be.revertedWith("Face value must be positive");
  });

  it("rejects due date in the past", async () => {
    const { seller, registry } = await loadFixture(deployFixture);
    const pastDate = (await time.latest()) - 1;

    await expect(
      registry.connect(seller).mintInvoice(FACE_VALUE, pastDate, CURRENCY_USDC, DOC_HASH, "Buyer", "")
    ).to.be.revertedWith("Due date must be in future");
  });

  it("emits InvoiceMinted event", async () => {
    const { seller, registry, dueDate } = await loadFixture(deployFixture);

    await expect(
      registry.connect(seller).mintInvoice(FACE_VALUE, dueDate, CURRENCY_USDC, DOC_HASH, "Buyer", "")
    ).to.emit(registry, "InvoiceMinted").withArgs(1, seller.address, FACE_VALUE, dueDate);
  });

  it("locks invoice into escrow when LendingPool calls lockInEscrow", async () => {
    const { owner, seller, registry, dueDate } = await loadFixture(deployFixture);

    await registry.connect(seller).mintInvoice(FACE_VALUE, dueDate, CURRENCY_USDC, DOC_HASH, "Buyer", "");
    await registry.connect(owner).lockInEscrow(1);

    const invoice = await registry.getInvoice(1);
    expect(invoice.status).to.equal(1);
  });

  it("blocks unauthorized callers from locking", async () => {
    const { seller, registry, dueDate } = await loadFixture(deployFixture);

    await registry.connect(seller).mintInvoice(FACE_VALUE, dueDate, CURRENCY_USDC, DOC_HASH, "Buyer", "");

    await expect(
      registry.connect(seller).lockInEscrow(1)
    ).to.be.revertedWith("Not authorized");
  });

});

describe("LendingPool", () => {

  async function auctionFixture() {
    const base = await loadFixture(deployFixture);
    const { seller, registry, pool, dueDate } = base;

    await registry.connect(seller).mintInvoice(FACE_VALUE, dueDate, CURRENCY_USDC, DOC_HASH, "Acme Corp", "");
    const invoiceId = 1;

    return { ...base, invoiceId };
  }

  it("accepts USDC deposits from lenders", async () => {
    const { lender1, usdc, pool } = await loadFixture(deployFixture);
    const depositAmount = ethers.parseUnits("5000", USDC_DECIMALS);

    await usdc.connect(lender1).approve(await pool.getAddress(), depositAmount);
    await pool.connect(lender1).deposit(depositAmount);

    expect(await pool.lenderDeposits(lender1.address)).to.equal(depositAmount);
    expect(await pool.totalDeposited()).to.equal(depositAmount);
  });

  it("emits Deposited event", async () => {
    const { lender1, usdc, pool } = await loadFixture(deployFixture);
    const depositAmount = ethers.parseUnits("5000", USDC_DECIMALS);

    await usdc.connect(lender1).approve(await pool.getAddress(), depositAmount);

    await expect(pool.connect(lender1).deposit(depositAmount))
      .to.emit(pool, "Deposited")
      .withArgs(lender1.address, depositAmount);
  });

  it("allows lender to withdraw idle balance", async () => {
    const { lender1, usdc, pool } = await loadFixture(deployFixture);
    const depositAmount = ethers.parseUnits("5000", USDC_DECIMALS);

    await usdc.connect(lender1).approve(await pool.getAddress(), depositAmount);
    await pool.connect(lender1).deposit(depositAmount);

    const balanceBefore = await usdc.balanceOf(lender1.address);
    await pool.connect(lender1).withdraw(depositAmount);
    const balanceAfter = await usdc.balanceOf(lender1.address);

    expect(balanceAfter - balanceBefore).to.equal(depositAmount);
    expect(await pool.lenderDeposits(lender1.address)).to.equal(0n);
  });

  it("creates an auction and locks invoice in escrow", async () => {
    const { seller, pool, registry, invoiceId } = await loadFixture(auctionFixture);

    const tx = await pool.connect(seller).createAuction(invoiceId);
    await tx.wait();

    const auctionId = 1;
    const auction = await pool.getAuction(auctionId);
    expect(auction.invoiceId).to.equal(invoiceId);
    expect(auction.cleared).to.equal(false);

    const invoice = await registry.getInvoice(invoiceId);
    expect(invoice.status).to.equal(1);
  });

  it("accepts bids from lenders with sufficient balance", async () => {
    const { seller, lender1, usdc, pool, invoiceId } = await loadFixture(auctionFixture);

    const deposit = ethers.parseUnits("5000", USDC_DECIMALS);
    await usdc.connect(lender1).approve(await pool.getAddress(), deposit);
    await pool.connect(lender1).deposit(deposit);

    await pool.connect(seller).createAuction(invoiceId);

    const bidAmount = ethers.parseUnits("3000", USDC_DECIMALS);
    const discountBps = 200;

    await expect(
      pool.connect(lender1).placeBid(1, bidAmount, discountBps)
    ).to.emit(pool, "BidPlaced").withArgs(1, lender1.address, bidAmount, discountBps);
  });

  it("rejects bids that exceed available balance", async () => {
    const { seller, lender1, usdc, pool, invoiceId } = await loadFixture(auctionFixture);

    const deposit = ethers.parseUnits("1000", USDC_DECIMALS);
    await usdc.connect(lender1).approve(await pool.getAddress(), deposit);
    await pool.connect(lender1).deposit(deposit);

    await pool.connect(seller).createAuction(invoiceId);

    const bidAmount = ethers.parseUnits("5000", USDC_DECIMALS);

    await expect(
      pool.connect(lender1).placeBid(1, bidAmount, 200)
    ).to.be.revertedWith("Insufficient available balance");
  });

  it("clears auction after 24 hours — selects lowest discount rate", async () => {
    const { seller, lender1, lender2, usdc, pool, registry, invoiceId } = await loadFixture(auctionFixture);

    const deposit = ethers.parseUnits("20000", USDC_DECIMALS);
    await usdc.connect(lender1).approve(await pool.getAddress(), deposit);
    await usdc.connect(lender2).approve(await pool.getAddress(), deposit);
    await pool.connect(lender1).deposit(deposit);
    await pool.connect(lender2).deposit(deposit);

    await pool.connect(seller).createAuction(invoiceId);

    await pool.connect(lender1).placeBid(1, FACE_VALUE, 300);
    await pool.connect(lender2).placeBid(1, FACE_VALUE, 200);

    await time.increase(24 * 60 * 60 + 1);

    await pool.connect(seller).clearAuction(1);

    const auction = await pool.getAuction(1);
    expect(auction.cleared).to.equal(true);
    expect(auction.clearingDiscountBps).to.equal(200);

    const invoice = await registry.getInvoice(invoiceId);
    expect(invoice.status).to.equal(2);
  });

  it("sends advance to seller after clearing", async () => {
    const { seller, lender1, usdc, pool, invoiceId } = await loadFixture(auctionFixture);

    const deposit = ethers.parseUnits("20000", USDC_DECIMALS);
    await usdc.connect(lender1).approve(await pool.getAddress(), deposit);
    await pool.connect(lender1).deposit(deposit);

    await pool.connect(seller).createAuction(invoiceId);
    await pool.connect(lender1).placeBid(1, FACE_VALUE, 200);

    await time.increase(24 * 60 * 60 + 1);

    const sellerBefore = await usdc.balanceOf(seller.address);
    await pool.connect(seller).clearAuction(1);
    const sellerAfter = await usdc.balanceOf(seller.address);

    const expectedAdvance = (FACE_VALUE * BigInt(10000 - 200)) / BigInt(10000);
    expect(sellerAfter - sellerBefore).to.equal(expectedAdvance);
  });

  it("rejects clearing before 24 hours", async () => {
    const { seller, lender1, usdc, pool, invoiceId } = await loadFixture(auctionFixture);

    const deposit = ethers.parseUnits("20000", USDC_DECIMALS);
    await usdc.connect(lender1).approve(await pool.getAddress(), deposit);
    await pool.connect(lender1).deposit(deposit);

    await pool.connect(seller).createAuction(invoiceId);
    await pool.connect(lender1).placeBid(1, FACE_VALUE, 200);

    await expect(pool.connect(seller).clearAuction(1)).to.be.revertedWith("Auction not ended");
  });

});
