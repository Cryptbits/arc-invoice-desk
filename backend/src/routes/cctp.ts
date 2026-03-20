import { Router, Request, Response } from "express";
import { z } from "zod";
import { initiateCCTPDeposit, getSupportedChains } from "../services/cctp";
import { getDb } from "../services/db";

export const cctpRoutes = Router();

cctpRoutes.get("/chains", (_req: Request, res: Response) => {
  res.json({
    supported: getSupportedChains(),
    destination: "arc",
    destinationDomain: 7,
  });
});

cctpRoutes.post("/deposit", async (req: Request, res: Response) => {
  try {
    const parsed = z.object({
      sourceChain: z.string(),
      amount: z.number().positive(),
      recipientAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      senderAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    }).safeParse(req.body);

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
      `INSERT INTO cctp_deposits (source_chain, amount, recipient_address, sender_address, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [sourceChain, amount, recipientAddress, senderAddress]
    );

    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

cctpRoutes.get("/status/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const result = await db.query(
      "SELECT * FROM cctp_deposits WHERE id = $1",
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Deposit not found" });
    res.json(result.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
