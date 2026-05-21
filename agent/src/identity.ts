import { createWalletClient, createPublicClient, http, parseAbi, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet, CONTRACTS, AGENT_NAME } from "./config";

const IDENTITY_ABI = parseAbi([
  "function registerAgent(string name, string metadata) external returns (bytes32 agentId)",
  "function getAgent(address addr) external view returns (bytes32 agentId, string name, string metadata, uint256 reputation, uint256 registeredAt)",
  "function isRegistered(address addr) external view returns (bool)",
]);

const REPUTATION_ABI = parseAbi([
  "function recordSuccess(bytes32 agentId, uint256 value) external",
  "function getReputation(bytes32 agentId) external view returns (uint256 score, uint256 successCount, uint256 totalValue)",
]);

export interface AgentIdentity {
  agentId: string;
  address: string;
  name: string;
  reputation: number;
}

export async function registerOrLoadIdentity(privateKey: string): Promise<AgentIdentity> {
  const account = privateKeyToAccount(privateKey as `0x${string}`);

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(process.env.ARC_RPC_URL),
  });

  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(process.env.ARC_RPC_URL),
  });

  console.log(`[Identity] Agent wallet: ${account.address}`);

  try {
    const isRegistered = await publicClient.readContract({
      address: CONTRACTS.IDENTITY_REGISTRY,
      abi: IDENTITY_ABI,
      functionName: "isRegistered",
      args: [account.address],
    });

    if (isRegistered) {
      console.log("[Identity] Agent already registered on Arc ERC-8004");
      const agentData = await publicClient.readContract({
        address: CONTRACTS.IDENTITY_REGISTRY,
        abi: IDENTITY_ABI,
        functionName: "getAgent",
        args: [account.address],
      }) as any[];

      return {
        agentId: agentData[0] as string,
        address: account.address,
        name: agentData[1] as string,
        reputation: Number(agentData[3]),
      };
    }

    console.log("[Identity] Registering agent identity on Arc ERC-8004...");

    const metadata = JSON.stringify({
      type: "lending-agent",
      version: "1.0.0",
      product: "Arc Invoice Desk",
      riskProfile: process.env.AGENT_RISK_PROFILE || "balanced",
      createdAt: new Date().toISOString(),
    });

    const txHash = await walletClient.writeContract({
      address: CONTRACTS.IDENTITY_REGISTRY,
      abi: IDENTITY_ABI,
      functionName: "registerAgent",
      args: [AGENT_NAME, metadata],
    });

    console.log(`[Identity] Registration tx: ${txHash}`);
    await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log("[Identity] Agent registered on Arc ERC-8004");

    const agentData = await publicClient.readContract({
      address: CONTRACTS.IDENTITY_REGISTRY,
      abi: IDENTITY_ABI,
      functionName: "getAgent",
      args: [account.address],
    }) as any[];

    return {
      agentId: agentData[0] as string,
      address: account.address,
      name: AGENT_NAME,
      reputation: 0,
    };
  } catch (error: any) {
    console.warn(`[Identity] ERC-8004 registration skipped (${error.message}) — running without on-chain identity`);
    return {
      agentId: `0x${Buffer.from(account.address).toString("hex").slice(0, 64)}`,
      address: account.address,
      name: AGENT_NAME,
      reputation: 0,
    };
  }
}

export async function recordReputation(
  agentId: string,
  settledValue: number,
  privateKey: string
): Promise<void> {
  try {
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: arcTestnet,
      transport: http(process.env.ARC_RPC_URL),
    });

    const valueBigInt = BigInt(Math.round(settledValue * 1e6));

    const txHash = await walletClient.writeContract({
      address: CONTRACTS.REPUTATION_REGISTRY,
      abi: REPUTATION_ABI,
      functionName: "recordSuccess",
      args: [agentId as `0x${string}`, valueBigInt],
    });

    console.log(`[Identity] Reputation updated on Arc — tx: ${txHash}`);
  } catch (error: any) {
    console.warn(`[Identity] Reputation update skipped: ${error.message}`);
  }
}
