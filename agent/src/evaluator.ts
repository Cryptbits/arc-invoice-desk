import OpenAI from "openai";
import { RISK_PROFILES, ACTIVE_PROFILE, AgentConfig } from "./config";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface Invoice {
  id: number;
  buyer_name: string;
  face_value: string;
  currency: string;
  due_date: string;
  description: string | null;
  seller_address: string;
  status: string;
  ipfs_cid: string | null;
  document_hash: string | null;
}

export interface EvaluationResult {
  invoiceId: number;
  decision: "bid" | "skip";
  recommendedDiscountBps: number;
  recommendedAmount: number;
  confidence: number;
  reasoning: string;
  riskScore: number;
  flags: string[];
}

export async function evaluateInvoice(
  invoice: Invoice,
  config: AgentConfig,
  availableBalance: number
): Promise<EvaluationResult> {
  const daysUntilDue = Math.ceil(
    (new Date(invoice.due_date).getTime() - Date.now()) / 86400000
  );
  const faceValue = parseFloat(invoice.face_value);

  const hardFlags: string[] = [];
  if (faceValue < config.minFaceValue) hardFlags.push("Below minimum face value");
  if (faceValue > config.maxFaceValue) hardFlags.push("Exceeds maximum face value");
  if (daysUntilDue < config.minDaysUntilDue) hardFlags.push("Insufficient days until due");
  if (availableBalance < 5) hardFlags.push("Insufficient agent balance");

  if (hardFlags.length > 0) {
    return {
      invoiceId: invoice.id,
      decision: "skip",
      recommendedDiscountBps: 0,
      recommendedAmount: 0,
      confidence: 1,
      reasoning: `Hard filter failed: ${hardFlags.join(", ")}`,
      riskScore: 0,
      flags: hardFlags,
    };
  }

  const prompt = `You are an autonomous AI lending agent participating in invoice discount auctions on Arc Network. You must evaluate this invoice and decide whether to bid on it.

INVOICE DETAILS:
- Invoice ID: ${invoice.id}
- Buyer company: ${invoice.buyer_name}
- Face value: $${faceValue} ${invoice.currency}
- Due date: ${invoice.due_date} (${daysUntilDue} days from now)
- Description: ${invoice.description || "No description provided"}
- Has document: ${invoice.ipfs_cid ? "Yes (PDF stored on IPFS)" : "No"}
- Seller address: ${invoice.seller_address}

YOUR RISK PROFILE: ${config.riskProfile.toUpperCase()}
- You have $${availableBalance.toFixed(2)} USDC available to lend
- Your target discount range: ${config.targetDiscountBps.min / 100}% to ${config.targetDiscountBps.max / 100}%
- Maximum bid amount: $${config.maxBidAmount}

EVALUATION CRITERIA:
1. Is the buyer name a real-sounding business entity?
2. Is the face value reasonable for the described services?
3. Is the due date far enough away to be realistic?
4. Does the description match a legitimate business transaction?
5. What discount rate reflects the actual risk level?

Respond with a JSON object only, no other text:
{
  "decision": "bid" or "skip",
  "recommendedDiscountBps": number between ${config.targetDiscountBps.min} and ${config.targetDiscountBps.max},
  "recommendedAmount": number (how much USDC to bid, max $${Math.min(config.maxBidAmount, availableBalance * 0.8).toFixed(0)}),
  "confidence": number between 0 and 1,
  "riskScore": number between 0 and 100 (higher is riskier),
  "reasoning": "one sentence explanation",
  "flags": ["array", "of", "concerns", "if", "any"]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 500,
    });

    const raw = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);

    return {
      invoiceId: invoice.id,
      decision: parsed.decision || "skip",
      recommendedDiscountBps: Math.min(
        Math.max(parsed.recommendedDiscountBps || config.targetDiscountBps.min, config.targetDiscountBps.min),
        config.targetDiscountBps.max
      ),
      recommendedAmount: Math.min(
        parsed.recommendedAmount || 0,
        config.maxBidAmount,
        availableBalance * 0.8
      ),
      confidence: parsed.confidence || 0,
      reasoning: parsed.reasoning || "No reasoning provided",
      riskScore: parsed.riskScore || 50,
      flags: parsed.flags || [],
    };
  } catch (error: any) {
    console.error(`[Evaluator] GPT-4o error for invoice ${invoice.id}:`, error.message);
    return {
      invoiceId: invoice.id,
      decision: "skip",
      recommendedDiscountBps: 0,
      recommendedAmount: 0,
      confidence: 0,
      reasoning: "Evaluation failed due to API error",
      riskScore: 100,
      flags: ["LLM evaluation error"],
    };
  }
}
