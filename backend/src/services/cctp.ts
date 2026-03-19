import { createPublicClient, http, parseAbi } from "viem";

const CCTP_ABI = parseAbi([
  "function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken) returns (uint64 nonce)",
  "event MessageSent(bytes message)",
  "event DepositForBurn(uint64 indexed nonce, address indexed burnToken, uint256 amount, address indexed depositor, bytes32 mintRecipient, uint32 destinationDomain, bytes32 destinationTokenMessenger, bytes32 destinationCaller)",
]);

const CHAIN_CONFIG: Record<string, { rpc: string; tokenMessenger: string; domain: number; usdcAddress: string; label: string }> = {
  "ethereum-sepolia": {
    rpc: "https://rpc.ankr.com/eth_sepolia",
    tokenMessenger: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
    domain: 0,
    usdcAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    label: "Ethereum Sepolia",
  },
  "base-sepolia": {
    rpc: "https://sepolia.base.org",
    tokenMessenger: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
    domain: 6,
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    label: "Base Sepolia",
  },
  "arbitrum-sepolia": {
    rpc: "https://sepolia-rollup.arbitrum.io/rpc",
    tokenMessenger: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
    domain: 3,
    usdcAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    label: "Arbitrum Sepolia",
  },
  arc: {
    rpc: process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network",
    tokenMessenger: process.env.ARC_TOKEN_MESSENGER || "0x0000000000000000000000000000000000000000",
    domain: 7,
    usdcAddress: process.env.ARC_USDC_ADDRESS || "0x0000000000000000000000000000000000000000",
    label: "Arc Testnet",
  },
};

export interface CCTPDepositParams {
  sourceChain: string;
  amount: string;
  recipientAddress: string;
  senderAddress: string;
}

export async function initiateCCTPDeposit(params: CCTPDepositParams) {
  const config = CHAIN_CONFIG[params.sourceChain];
  if (!config) throw new Error(`Unsupported chain: ${params.sourceChain}. Use: ${Object.keys(CHAIN_CONFIG).filter(k => k !== "arc").join(", ")}`);

  const amountNum = parseFloat(params.amount);
  if (amountNum < 5) throw new Error("Minimum CCTP deposit is 5 USDC");

  const recipientPadded = params.recipientAddress.toLowerCase().replace("0x", "0x000000000000000000000000");

  console.log(`CCTP deposit: ${params.amount} USDC from ${config.label} to Arc Testnet`);
  console.log(`Recipient: ${params.recipientAddress}`);
  console.log(`Token Messenger: ${config.tokenMessenger}`);
  console.log(`Destination Domain: 7 (Arc Testnet)`);

  return {
    initiated: true,
    sourceChain: params.sourceChain,
    sourceChainLabel: config.label,
    destinationChain: "arc",
    amount: params.amount,
    recipientAddress: params.recipientAddress,
    tokenMessenger: config.tokenMessenger,
    destinationDomain: 7,
    mintRecipient: recipientPadded,
    estimatedTime: "2-5 minutes",
    nextStep: "Call depositForBurn on the Token Messenger contract from your wallet, then wait for Circle attestation.",
  };
}

export async function getCCTPDepositStatus(txHash: string) {
  return {
    txHash,
    status: "pending",
    message: "Waiting for Circle attestation. This takes 2-5 minutes on testnet.",
  };
}

export function getSupportedChains() {
  return Object.entries(CHAIN_CONFIG)
    .filter(([key]) => key !== "arc")
    .map(([key, config]) => ({
      id: key,
      label: config.label,
      domain: config.domain,
      usdcAddress: config.usdcAddress,
      tokenMessenger: config.tokenMessenger,
      network: "testnet",
    }));
}
