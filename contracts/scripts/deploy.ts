import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  const USDC_ADDRESS = process.env.USDC_ADDRESS || "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

  console.log("\nDeploying InvoiceRegistry...");
  const InvoiceRegistry = await ethers.getContractFactory("InvoiceRegistry");
  const registry = await InvoiceRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("InvoiceRegistry deployed to:", registryAddress);

  console.log("\nDeploying LendingPool...");
  const LendingPool = await ethers.getContractFactory("LendingPool");
  const pool = await LendingPool.deploy(USDC_ADDRESS, registryAddress);
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();
  console.log("LendingPool deployed to:", poolAddress);

  console.log("\nDeploying FXSettlement...");
  const FXSettlement = await ethers.getContractFactory("FXSettlement");
  const settlement = await FXSettlement.deploy(
    registryAddress,
    poolAddress,
    USDC_ADDRESS,
    deployer.address
  );
  await settlement.waitForDeployment();
  const settlementAddress = await settlement.getAddress();
  console.log("FXSettlement deployed to:", settlementAddress);

  console.log("\nWiring contracts together...");
  await registry.setLendingPool(poolAddress);
  await registry.setFxSettlement(settlementAddress);
  await pool.setFxSettlement(settlementAddress);
  console.log("Registry authorized: LendingPool + FXSettlement");
  console.log("LendingPool authorized: FXSettlement for recordRepayment");

  const EURC_ADDRESS = process.env.EURC_ADDRESS || "";
  if (EURC_ADDRESS) {
    await settlement.registerCurrency(ethers.encodeBytes32String("EURC"), EURC_ADDRESS);
    console.log("Registered EURC currency");
  }
  await settlement.registerCurrency(ethers.encodeBytes32String("USDC"), USDC_ADDRESS);
  console.log("Registered USDC currency");

  const deploymentInfo = {
    network: "arc-testnet",
    chainId: 600100,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      InvoiceRegistry: registryAddress,
      LendingPool: poolAddress,
      FXSettlement: settlementAddress,
      USDC: USDC_ADDRESS,
    },
  };

  const outputPath = path.join(__dirname, "../deployments.json");
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\nDeployment info saved to deployments.json");

  const frontendPath = path.join(__dirname, "../../frontend/src/lib/contracts.json");
  fs.writeFileSync(frontendPath, JSON.stringify(deploymentInfo.contracts, null, 2));
  console.log("Contract addresses written to frontend/src/lib/contracts.json");

  console.log("\nDeployment complete.");
  console.log("InvoiceRegistry:", registryAddress);
  console.log("LendingPool:    ", poolAddress);
  console.log("FXSettlement:   ", settlementAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
