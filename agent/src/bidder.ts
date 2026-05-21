import axios from "axios";
import { API_URL } from "./config";
import { EvaluationResult } from "./evaluator";

export interface BidResult {
  success: boolean;
  invoiceId: number;
  amount: number;
  discountBps: number;
  error?: string;
}

export interface LenderState {
  deposited_amount: string;
  active_amount: string;
  total_yield_earned: string;
}

export async function getLenderState(agentAddress: string): Promise<LenderState> {
  try {
    const res = await axios.get(`${API_URL}/api/lenders/${agentAddress.toLowerCase()}`);
    return res.data;
  } catch {
    return { deposited_amount: "0", active_amount: "0", total_yield_earned: "0" };
  }
}

export async function ensureDeposit(agentAddress: string, amount: number): Promise<void> {
  try {
    await axios.post(`${API_URL}/api/lenders/register`, { address: agentAddress });
    await axios.post(`${API_URL}/api/lenders/deposit`, {
      lenderAddress: agentAddress,
      amount,
    });
    console.log(`[Bidder] Deposited $${amount} USDC to lending pool`);
  } catch (error: any) {
    console.warn(`[Bidder] Deposit failed: ${error.message}`);
  }
}

export async function placeBid(
  evaluation: EvaluationResult,
  agentAddress: string
): Promise<BidResult> {
  try {
    const res = await axios.post(`${API_URL}/api/lenders/bid`, {
      lenderAddress: agentAddress,
      invoiceId: evaluation.invoiceId,
      amount: Math.round(evaluation.recommendedAmount * 100) / 100,
      discountBps: evaluation.recommendedDiscountBps,
    });

    console.log(
      `[Bidder] Bid placed on invoice ${evaluation.invoiceId} — ` +
      `$${evaluation.recommendedAmount} at ${(evaluation.recommendedDiscountBps / 100).toFixed(2)}% ` +
      `(confidence: ${(evaluation.confidence * 100).toFixed(0)}%)`
    );

    return {
      success: true,
      invoiceId: evaluation.invoiceId,
      amount: evaluation.recommendedAmount,
      discountBps: evaluation.recommendedDiscountBps,
    };
  } catch (error: any) {
    const msg = error.response?.data?.error || error.message;
    console.error(`[Bidder] Bid failed on invoice ${evaluation.invoiceId}: ${msg}`);
    return {
      success: false,
      invoiceId: evaluation.invoiceId,
      amount: 0,
      discountBps: 0,
      error: msg,
    };
  }
}

export async function getActiveBids(agentAddress: string): Promise<any[]> {
  try {
    const res = await axios.get(`${API_URL}/api/lenders/${agentAddress.toLowerCase()}/portfolio`);
    return res.data.positions || [];
  } catch {
    return [];
  }
}

export async function getLiveAuctions(): Promise<any[]> {
  try {
    const res = await axios.get(`${API_URL}/api/invoices?status=auctioning&limit=20`);
    return res.data.data || [];
  } catch {
    return [];
  }
}
