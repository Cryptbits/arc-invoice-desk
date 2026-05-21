import express from "express";
import { getLenderState } from "./bidder";
import { getTrackedPositions, getAgentStats } from "./monitor";
import { privateKeyToAccount } from "viem/accounts";

const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY || "";
const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
const agentAddress = account.address.toLowerCase();

export function startApiServer(port = 3002): void {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      status: "running",
      agent: process.env.AGENT_NAME || "ArcFi Lending Agent v1",
      address: account.address,
      riskProfile: process.env.AGENT_RISK_PROFILE || "balanced",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/stats", async (_req, res) => {
    try {
      const [state, stats, positions] = await Promise.all([
        getLenderState(agentAddress),
        getAgentStats(agentAddress),
        Promise.resolve(getTrackedPositions()),
      ]);

      const deposited = parseFloat(state.deposited_amount || "0");
      const active = parseFloat(state.active_amount || "0");

      res.json({
        wallet: account.address,
        riskProfile: process.env.AGENT_RISK_PROFILE || "balanced",
        balance: {
          deposited: deposited.toFixed(2),
          active: active.toFixed(2),
          available: Math.max(0, deposited - active).toFixed(2),
          yieldEarned: parseFloat(state.total_yield_earned || "0").toFixed(2),
        },
        performance: {
          totalBids: stats.totalBids,
          activePositions: stats.activePositions,
          settledInvoices: stats.settled,
          totalYield: parseFloat(stats.totalYield).toFixed(2),
        },
        positions: positions.map(p => ({
          invoiceId: p.invoiceId,
          amount: p.amount,
          discountRate: `${(p.discountBps / 100).toFixed(2)}%`,
          expectedYield: `$${(p.amount * p.discountBps / 10000).toFixed(2)}`,
          biddedAt: p.biddedAt,
        })),
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.listen(port, () => {
    console.log(`[API] Agent dashboard running at http://localhost:${port}`);
    console.log(`[API] Health: http://localhost:${port}/health`);
    console.log(`[API] Stats:  http://localhost:${port}/stats`);
  });
}
