import { defineChain } from "viem";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network"] },
    public:  { http: [process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

export const CONTRACTS = {
  USDC:                "0x3600000000000000000000000000000000000000" as `0x${string}`,
  EURC:                "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" as `0x${string}`,
  IDENTITY_REGISTRY:   "0x8004A818BFB912233c491871b3d84c89A494BD9e" as `0x${string}`,
  REPUTATION_REGISTRY: "0x8004B663056A597Dffe9eCcC1965A193B7388713" as `0x${string}`,
  AGENTIC_COMMERCE:    "0x0747EEf0706327138c69792bF28Cd525089e4583" as `0x${string}`,
  FX_ESCROW:           "0x867650F5eAe8df91445971f14d89fd84F0C9a9f8" as `0x${string}`,
};

export type RiskProfile = "conservative" | "balanced" | "aggressive";

export interface AgentConfig {
  riskProfile: RiskProfile;
  maxBidAmount: number;
  minFaceValue: number;
  maxFaceValue: number;
  minDaysUntilDue: number;
  targetDiscountBps: { min: number; max: number };
  maxActivePositions: number;
  evaluationIntervalMs: number;
}

export const RISK_PROFILES: Record<RiskProfile, AgentConfig> = {
  conservative: {
    riskProfile: "conservative",
    maxBidAmount: 50,
    minFaceValue: 10,
    maxFaceValue: 5000,
    minDaysUntilDue: 5,
    targetDiscountBps: { min: 150, max: 220 },
    maxActivePositions: 3,
    evaluationIntervalMs: 60_000,
  },
  balanced: {
    riskProfile: "balanced",
    maxBidAmount: 100,
    minFaceValue: 10,
    maxFaceValue: 50000,
    minDaysUntilDue: 2,
    targetDiscountBps: { min: 200, max: 280 },
    maxActivePositions: 5,
    evaluationIntervalMs: 45_000,
  },
  aggressive: {
    riskProfile: "aggressive",
    maxBidAmount: 200,
    minFaceValue: 10,
    maxFaceValue: 100000,
    minDaysUntilDue: 1,
    targetDiscountBps: { min: 250, max: 350 },
    maxActivePositions: 10,
    evaluationIntervalMs: 30_000,
  },
};

export const ACTIVE_PROFILE: RiskProfile = (process.env.AGENT_RISK_PROFILE as RiskProfile) || "balanced";
export const AGENT_NAME = process.env.AGENT_NAME || "ArcFi Lending Agent v1";
export const API_URL = process.env.API_URL || "http://localhost:3001";
