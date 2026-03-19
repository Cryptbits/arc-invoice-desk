import { createHash } from "crypto";

export interface VerificationResult {
  passed: boolean;
  score: number;
  flags: string[];
  recommendation: "approve" | "review" | "reject";
}

const flaggedAddresses = new Set<string>();
const submissionHistory = new Map<string, { count: number; lastAt: number; totalValue: number }>();

export function verifyInvoiceSubmission(params: {
  sellerAddress: string;
  buyerName: string;
  faceValue: number;
  currency: string;
  dueDateTs: number;
  description?: string;
}): VerificationResult {
  const flags: string[] = [];
  let score = 100;

  const { sellerAddress, buyerName, faceValue, dueDateTs, description } = params;
  const addr = sellerAddress.toLowerCase();

  if (flaggedAddresses.has(addr)) {
    flags.push("Address flagged in previous review");
    score -= 60;
  }

  const daysUntilDue = (dueDateTs * 1000 - Date.now()) / 86400000;
  if (daysUntilDue < 3) { flags.push("Due date less than 3 days away"); score -= 25; }
  if (daysUntilDue > 365) { flags.push("Due date more than 1 year away"); score -= 20; }

  if (faceValue < 100)        { flags.push("Face value below minimum ($100)");       score -= 40; }
  if (faceValue > 10_000_000) { flags.push("Face value exceeds maximum ($10M)");     score -= 40; }
  if (faceValue > 1_000_000)  { flags.push("Large invoice — enhanced review required"); score -= 10; }

  if (buyerName.length < 3)     { flags.push("Buyer name too short"); score -= 20; }
  if (/test|fake|demo/i.test(buyerName) && process.env.NODE_ENV === "production") {
    flags.push("Suspicious buyer name"); score -= 30;
  }
  if (!description || description.length < 5) { flags.push("No invoice description provided"); score -= 5; }

  const history = submissionHistory.get(addr);
  const now = Date.now();
  if (history) {
    const hoursSinceLast = (now - history.lastAt) / 3600000;
    if (history.count >= 10 && hoursSinceLast < 24) {
      flags.push("High submission rate — 10+ invoices in 24h"); score -= 30;
    }
    if (history.totalValue > 5_000_000 && hoursSinceLast < 24) {
      flags.push("High cumulative value in 24h — $5M+ submitted"); score -= 20;
    }
    submissionHistory.set(addr, {
      count: history.count + 1,
      lastAt: now,
      totalValue: history.totalValue + faceValue,
    });
  } else {
    submissionHistory.set(addr, { count: 1, lastAt: now, totalValue: faceValue });
  }

  score = Math.max(0, Math.min(100, score));

  let recommendation: "approve" | "review" | "reject";
  if (score >= 70)      recommendation = "approve";
  else if (score >= 40) recommendation = "review";
  else                  recommendation = "reject";

  return { passed: recommendation !== "reject", score, flags, recommendation };
}

export function flagAddress(address: string, reason: string): void {
  flaggedAddresses.add(address.toLowerCase());
  console.warn(`[Fraud] Address flagged: ${address} — ${reason}`);
}

export function unflagAddress(address: string): void {
  flaggedAddresses.delete(address.toLowerCase());
}

export function verifyLenderDeposit(params: {
  lenderAddress: string;
  amount: number;
}): VerificationResult {
  const flags: string[] = [];
  let score = 100;

  const { lenderAddress, amount } = params;

  if (flaggedAddresses.has(lenderAddress.toLowerCase())) {
    flags.push("Lender address flagged"); score -= 60;
  }
  if (amount < 10)         { flags.push("Deposit below minimum ($10)");       score -= 50; }
  if (amount > 50_000_000) { flags.push("Deposit exceeds maximum ($50M)");    score -= 40; }
  if (amount > 1_000_000)  { flags.push("Large deposit — enhanced KYC required"); score -= 10; }

  score = Math.max(0, score);
  const recommendation = score >= 70 ? "approve" : score >= 40 ? "review" : "reject";
  return { passed: recommendation !== "reject", score, flags, recommendation };
}
