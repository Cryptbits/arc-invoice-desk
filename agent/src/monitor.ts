import axios from "axios";
import { API_URL } from "./config";
import { recordReputation } from "./identity";

interface TrackedPosition {
  invoiceId: number;
  amount: number;
  discountBps: number;
  biddedAt: Date;
}

const trackedPositions = new Map<number, TrackedPosition>();

export function trackPosition(invoiceId: number, amount: number, discountBps: number): void {
  trackedPositions.set(invoiceId, {
    invoiceId,
    amount,
    discountBps,
    biddedAt: new Date(),
  });
}

export async function checkSettlements(
  agentId: string,
  agentAddress: string,
  privateKey: string
): Promise<void> {
  if (trackedPositions.size === 0) return;

  for (const [invoiceId, position] of trackedPositions.entries()) {
    try {
      const res = await axios.get(`${API_URL}/api/invoices/${invoiceId}`);
      const invoice = res.data;

      if (invoice.status === "settled") {
        const yieldEarned = position.amount * (position.discountBps / 10000);
        console.log(
          `[Monitor] Invoice ${invoiceId} settled — ` +
          `principal $${position.amount} + yield $${yieldEarned.toFixed(2)} returned`
        );

        await recordReputation(agentId, position.amount + yieldEarned, privateKey);
        trackedPositions.delete(invoiceId);
        console.log(`[Monitor] Reputation updated on Arc for invoice ${invoiceId}`);
      } else if (invoice.status === "defaulted") {
        console.warn(`[Monitor] Invoice ${invoiceId} DEFAULTED — position loss recorded`);
        trackedPositions.delete(invoiceId);
      }
    } catch (error: any) {
      console.warn(`[Monitor] Could not check invoice ${invoiceId}: ${error.message}`);
    }
  }
}

export function getTrackedPositions(): TrackedPosition[] {
  return Array.from(trackedPositions.values());
}

export async function getAgentStats(agentAddress: string): Promise<{
  totalBids: number;
  activePositions: number;
  totalYield: string;
  settled: number;
}> {
  try {
    const res = await axios.get(`${API_URL}/api/lenders/${agentAddress.toLowerCase()}/portfolio`);
    const data = res.data;
    const positions = data.positions || [];
    const summary = data.summary || {};
    return {
      totalBids: positions.length,
      activePositions: trackedPositions.size,
      totalYield: summary.yield_earned || "0",
      settled: positions.filter((p: any) => p.invoice_status === "settled").length,
    };
  } catch {
    return { totalBids: 0, activePositions: 0, totalYield: "0", settled: 0 };
  }
}
