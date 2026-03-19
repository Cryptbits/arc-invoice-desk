import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  initiateCCTPDeposit,
  getCCTPDepositStatus,
  getSupportedChains,
} from "../services/cctp";
import { getDb } from "../services/db";

export const cctpRoutes = Router();

const InitiateSchema = z.object({
  sourceChain: z.string(),
  amount: z.number().positive(),
  recipientAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  senderAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

cctpRoutes.get("/chains", (_req: Request, res: Response) => {
  res.json({
    supported: getSupportedChains(),
    destination: "arc",
    destinationDomain: 7,
  });
});

cctpRoutes.post("/deposit", async (req: Request, res: Response) => {
  const parsed = InitiateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { sourceChain, amount, recipientAddress, senderAddress } = parsed.data;

  const result = await initiateCCTPDeposit({
    sourceChain,
    amount: amount.toString(),
    recipientAddress,
    senderAddress,
  });

  const db = getDb();
  await db.query(
    `INSERT INTO cctp_deposits (tx_hash, source_chain, destination_chain, amount, recipient_address, sender_address, status, created_at)
     VALUES ($1, $2, 'arc', $3, $4, $5, 'pending', NOW())
     ON CONFLICT DO NOTHING`,
    [result.txHash, sourceChain, amount, recipientAddress, senderAddress]
  ).catch(() => {});

  res.status(201).json(result);
});

cctpRoutes.get("/deposit/:txHash/status", async (req: Request, res: Response) => {
  const status = await getCCTPDepositStatus(req.params.txHash);
  res.json({ txHash: req.params.txHash, status });
});

cctpRoutes.get("/deposits", async (req: Request, res: Response) => {
  const db = getDb();
  const { address } = req.query;

  try {
    let query = "SELECT * FROM cctp_deposits ORDER BY created_at DESC LIMIT 20";
    const params: unknown[] = [];

    if (address) {
      query = "SELECT * FROM cctp_deposits WHERE recipient_address = $1 OR sender_address = $1 ORDER BY created_at DESC LIMIT 20";
      params.push(address);
    }

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch {
    res.json([]);
  }
});
