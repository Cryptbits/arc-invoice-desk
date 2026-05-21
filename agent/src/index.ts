import dotenv from "dotenv";
dotenv.config();

import { privateKeyToAccount } from "viem/accounts";
import { RISK_PROFILES, ACTIVE_PROFILE, API_URL } from "./config";
import { evaluateInvoice } from "./evaluator";
import { placeBid, getLiveAuctions, getLenderState, ensureDeposit } from "./bidder";
import { trackPosition, checkSettlements, getAgentStats, getTrackedPositions } from "./monitor";
import { registerOrLoadIdentity } from "./identity";

const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY || "";
const INITIAL_DEPOSIT = parseFloat(process.env.AGENT_INITIAL_DEPOSIT || "500");

if (!PRIVATE_KEY) {
  console.error("[Agent] AGENT_PRIVATE_KEY is required in .env");
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error("[Agent] OPENAI_API_KEY is required in .env");
  process.exit(1);
}

const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
const agentAddress = account.address.toLowerCase();
const config = RISK_PROFILES[ACTIVE_PROFILE];

const biddedInvoices = new Set<number>();

function banner() {
  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║       ArcFi Lending Agent v1.0             ║");
  console.log("║       Built on Arc Network                  ║");
  console.log("╚════════════════════════════════════════════╝");
  console.log(`  Wallet:       ${account.address}`);
  console.log(`  Risk profile: ${ACTIVE_PROFILE.toUpperCase()}`);
  console.log(`  API:          ${API_URL}`);
  console.log(`  Interval:     ${config.evaluationIntervalMs / 1000}s`);
  console.log("─".repeat(48));
}

async function runCycle(agentId: string): Promise<void> {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`\n[${timestamp}] Starting evaluation cycle...`);

  const state = await getLenderState(agentAddress);
  const deposited = parseFloat(state.deposited_amount || "0");
  const active = parseFloat(state.active_amount || "0");
  const available = Math.max(0, deposited - active);
  const yieldEarned = parseFloat(state.total_yield_earned || "0");

  console.log(`[Agent] Balance — deposited: $${deposited.toFixed(2)} | active: $${active.toFixed(2)} | available: $${available.toFixed(2)} | yield: $${yieldEarned.toFixed(2)}`);

  await checkSettlements(agentId, agentAddress, PRIVATE_KEY);

  const activePositions = getTrackedPositions();
  if (activePositions.length >= config.maxActivePositions) {
    console.log(`[Agent] Max positions reached (${config.maxActivePositions}). Waiting for settlements.`);
    return;
  }

  const auctions = await getLiveAuctions();
  const openAuctions = auctions.filter((a: any) => !biddedInvoices.has(a.id));

  if (openAuctions.length === 0) {
    console.log("[Agent] No new auctions to evaluate.");
    return;
  }

  console.log(`[Agent] Found ${openAuctions.length} new auction(s) to evaluate.`);

  for (const auction of openAuctions) {
    if (available < 5) {
      console.log("[Agent] Available balance too low to bid. Skipping remaining auctions.");
      break;
    }

    console.log(`\n[Agent] Evaluating invoice ${auction.id} — ${auction.buyer_name} — $${parseFloat(auction.face_value).toLocaleString()} ${auction.currency}`);

    const evaluation = await evaluateInvoice(auction, config, available);

    console.log(`[Agent] Decision: ${evaluation.decision.toUpperCase()} | Risk: ${evaluation.riskScore}/100 | Confidence: ${(evaluation.confidence * 100).toFixed(0)}%`);
    console.log(`[Agent] Reasoning: ${evaluation.reasoning}`);

    if (evaluation.flags.length > 0) {
      console.log(`[Agent] Flags: ${evaluation.flags.join(", ")}`);
    }

    if (evaluation.decision === "bid" && evaluation.recommendedAmount >= 5) {
      const result = await placeBid(evaluation, agentAddress);

      if (result.success) {
        biddedInvoices.add(auction.id);
        trackPosition(auction.id, result.amount, result.discountBps);
      }
    } else {
      biddedInvoices.add(auction.id);
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  const stats = await getAgentStats(agentAddress);
  console.log(`\n[Agent] Stats — total bids: ${stats.totalBids} | active: ${stats.activePositions} | yield earned: $${parseFloat(stats.totalYield).toFixed(2)} | settled: ${stats.settled}`);
}

async function main() {
  banner();

  console.log("\n[Agent] Registering identity on Arc ERC-8004...");
  const identity = await registerOrLoadIdentity(PRIVATE_KEY);
  console.log(`[Agent] Identity — ${identity.name} | ${identity.address}`);

  const state = await getLenderState(agentAddress);
  const currentDeposit = parseFloat(state.deposited_amount || "0");

  if (currentDeposit === 0) {
    console.log(`[Agent] Making initial deposit of $${INITIAL_DEPOSIT} USDC...`);
    await ensureDeposit(agentAddress, INITIAL_DEPOSIT);
  } else {
    console.log(`[Agent] Existing deposit found: $${currentDeposit.toFixed(2)} USDC`);
  }

  console.log(`\n[Agent] Running first evaluation cycle...`);
  await runCycle(identity.agentId);

  console.log(`\n[Agent] Scheduling cycles every ${config.evaluationIntervalMs / 1000}s`);

  setInterval(async () => {
    try {
      await runCycle(identity.agentId);
    } catch (error: any) {
      console.error(`[Agent] Cycle error: ${error.message}`);
    }
  }, config.evaluationIntervalMs);
}

main().catch(error => {
  console.error("[Agent] Fatal error:", error.message);
  process.exit(1);
});

// Start agent API server on port 3002
import { startApiServer } from "./api";
startApiServer(3002);
