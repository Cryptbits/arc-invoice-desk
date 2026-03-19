import { Router, Request, Response } from "express";
import { z } from "zod";
import { getDb } from "../services/db";
import { getSwapQuote } from "../services/stablefx";
import { settlementQueue } from "../jobs/queue";

export const settlementRoutes = Router();

settlementRoutes.get("/quote/:invoiceId", async (req: Request, res: Response) => {
  const db = getDb();
  const invoice = await db.query("SELECT * FROM invoices WHERE id = $1", [req.params.invoiceId]);
  if (!invoice.rows[0]) return res.status(404).json({ error: "Invoice not found" });

  const inv = invoice.rows[0];
  const paymentCurrency = (req.query.currency as string) || inv.currency;

  const quote = await getSwapQuote(paymentCurrency, "USDC", parseFloat(inv.face_value));

  res.json({
    invoiceId: req.params.invoiceId,
    faceValue: inv.face_value,
    currency: inv.currency,
    dueDate: inv.due_date,
    paymentCurrency,
    ...quote,
    protocolFeeBps: 30,
  });
});

settlementRoutes.post("/execute", async (req: Request, res: Response) => {
  const parsed = z.object({
    invoiceId: z.number(),
    paymentCurrency: z.string().default("USDC"),
    paymentAmount: z.number().positive(),
    payerAddress: z.string(),
    txHash: z.string().optional(),
  }).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { invoiceId, paymentCurrency, paymentAmount, txHash } = parsed.data;
  const db = getDb();

  const invoice = await db.query(
    "SELECT * FROM invoices WHERE id = $1 AND status = 'funded'", [invoiceId]
  );
  if (!invoice.rows[0]) return res.status(404).json({ error: "Invoice not found or not in funded state" });

  const now = new Date();
  const dueDate = new Date(invoice.rows[0].due_date);
  if (now < dueDate) {
    return res.status(400).json({
      error: "Invoice not yet due",
      dueDate: dueDate.toISOString(),
      daysRemaining: Math.ceil((dueDate.getTime() - now.getTime()) / 86400000),
    });
  }

  const job = await settlementQueue.add("execute-settlement", {
    invoiceId,
    auctionId: invoice.rows[0].auction_id,
    paymentCurrency,
    paymentAmount,
    txHash,
  });

  res.json({
    message: "Settlement initiated",
    jobId: job.id,
    invoiceId,
    paymentCurrency,
    paymentAmount,
    status: "processing",
  });
});

settlementRoutes.get("/status/:invoiceId", async (req: Request, res: Response) => {
  const db = getDb();
  const invoice = await db.query("SELECT * FROM invoices WHERE id = $1", [req.params.invoiceId]);
  if (!invoice.rows[0]) return res.status(404).json({ error: "Not found" });

  const settlement = await db.query(
    "SELECT * FROM settlements WHERE invoice_id = $1 ORDER BY settled_at DESC LIMIT 1",
    [req.params.invoiceId]
  );

  res.json({
    invoice: invoice.rows[0],
    settlement: settlement.rows[0] || null,
  });
});

settlementRoutes.get("/history", async (_req: Request, res: Response) => {
  const db = getDb();
  const result = await db.query(
    `SELECT s.*, i.buyer_name, i.seller_address, i.currency
     FROM settlements s
     JOIN invoices i ON s.invoice_id = i.id
     ORDER BY s.settled_at DESC LIMIT 50`
  );
  res.json(result.rows);
});
