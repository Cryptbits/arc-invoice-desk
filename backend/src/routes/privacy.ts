import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  createCommitment,
  revealCommitment,
  verifyCommitment,
  createShieldedBid,
  revealBid,
} from "../services/privacy";
import { getDb } from "../services/db";

export const privacyRoutes = Router();

privacyRoutes.post("/commit", (req: Request, res: Response) => {
  const parsed = z.object({
    value: z.number().positive(),
    currency: z.string().default("USDC"),
  }).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const commitment = createCommitment(parsed.data.value, parsed.data.currency);

  res.json({
    commitment: commitment.commitment,
    salt: commitment.salt,
    createdAt: commitment.createdAt,
    instruction: "Store the salt securely. Submit only the commitment on-chain. Reveal salt + value after auction closes.",
  });
});

privacyRoutes.post("/reveal", (req: Request, res: Response) => {
  const parsed = z.object({
    commitment: z.string(),
    salt: z.string(),
    value: z.number(),
    currency: z.string(),
  }).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { commitment, salt, value, currency } = parsed.data;
  const result = revealCommitment(commitment, salt, value, currency);

  res.json(result);
});

privacyRoutes.post("/verify", (req: Request, res: Response) => {
  const parsed = z.object({
    commitment: z.string(),
    value: z.number(),
    currency: z.string(),
    salt: z.string(),
  }).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { commitment, value, currency, salt } = parsed.data;
  const valid = verifyCommitment(commitment, value, currency, salt);

  res.json({ valid, commitment });
});

privacyRoutes.post("/bid/shield", async (req: Request, res: Response) => {
  const parsed = z.object({
    lenderAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    invoiceId: z.number().int().positive(),
    amount: z.number().positive(),
    discountBps: z.number().int().min(1).max(2000),
  }).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { lenderAddress, invoiceId, amount, discountBps } = parsed.data;
  const shielded = createShieldedBid(lenderAddress, invoiceId, amount, discountBps);

  const db = getDb();
  await db.query(
    `INSERT INTO shielded_bids (commitment, invoice_id, lender_address, created_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (commitment) DO NOTHING`,
    [shielded.commitment, invoiceId, lenderAddress]
  ).catch(() => {});

  res.json({
    ...shielded,
    message: "Bid shielded. Your amount and discount are hidden until auction reveal.",
  });
});

privacyRoutes.post("/bid/reveal", async (req: Request, res: Response) => {
  const parsed = z.object({
    commitment: z.string(),
    lenderAddress: z.string(),
    invoiceId: z.number(),
    amount: z.number(),
    discountBps: z.number(),
    salt: z.string(),
  }).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { commitment, lenderAddress, invoiceId, amount, discountBps, salt } = parsed.data;
  const valid = revealBid(commitment, lenderAddress, invoiceId, amount, discountBps, salt);

  res.json({
    valid,
    commitment,
    message: valid
      ? "Bid verified. Amount and discount confirmed."
      : "Verification failed. Salt or values do not match the commitment.",
  });
});
