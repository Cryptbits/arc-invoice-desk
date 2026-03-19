import { Router, Request, Response } from "express";
import { z } from "zod";
import { getDb } from "../services/db";
import { createWallet } from "../services/circle";

export const lenderRoutes = Router();

lenderRoutes.get("/:address", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const result = await db.query(
      "SELECT * FROM lenders WHERE address = $1",
      [req.params.address.toLowerCase()]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Lender not found" });
    const bids = await db.query(
      `SELECT b.*, i.buyer_name, i.face_value, i.due_date, i.status as invoice_status
       FROM bids b JOIN invoices i ON b.invoice_id = i.id
       WHERE b.lender_address = $1 ORDER BY b.created_at DESC`,
      [req.params.address.toLowerCase()]
    );
    res.json({ ...result.rows[0], bids: bids.rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

lenderRoutes.post("/register", async (req: Request, res: Response) => {
  try {
    const parsed = z.object({ address: z.string().regex(/^0x[a-fA-F0-9]{40}$/) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid wallet address" });

    const db = getDb();
    const address = parsed.data.address.toLowerCase();
    const existing = await db.query("SELECT * FROM lenders WHERE address = $1", [address]);
    if (existing.rows[0]) return res.json(existing.rows[0]);

    let walletId = null;
    if (process.env.CIRCLE_WALLET_SET_ID) {
      const wallet = await createWallet(process.env.CIRCLE_WALLET_SET_ID, address);
      if (wallet?.id) walletId = wallet.id;
    }

    const result = await db.query(
      "INSERT INTO lenders (address, wallet_id) VALUES ($1, $2) RETURNING *",
      [address, walletId]
    );
    res.status(201).json(result.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

lenderRoutes.post("/deposit", async (req: Request, res: Response) => {
  try {
    const parsed = z.object({
      lenderAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      amount: z.number().positive(),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid deposit data" });

    const db = getDb();
    const { lenderAddress, amount } = parsed.data;
    const addr = lenderAddress.toLowerCase();

    await db.query(
      `INSERT INTO lenders (address, deposited_amount) VALUES ($1, $2)
       ON CONFLICT (address) DO UPDATE SET deposited_amount = lenders.deposited_amount + $2, updated_at = NOW()`,
      [addr, amount]
    );

    const updated = await db.query("SELECT * FROM lenders WHERE address = $1", [addr]);
    res.json({
      message: "Deposit recorded on Arc",
      amount,
      lender: updated.rows[0],
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

lenderRoutes.post("/bid", async (req: Request, res: Response) => {
  try {
    const parsed = z.object({
      lenderAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      invoiceId: z.number().int().positive(),
      amount: z.number().positive(),
      discountBps: z.number().int().min(1).max(2000),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid bid data", details: parsed.error.flatten().fieldErrors });

    const db = getDb();
    const { lenderAddress, invoiceId, amount, discountBps } = parsed.data;
    const addr = lenderAddress.toLowerCase();

    await db.query(
      `INSERT INTO lenders (address) VALUES ($1) ON CONFLICT (address) DO NOTHING`,
      [addr]
    );

    const lender = await db.query("SELECT * FROM lenders WHERE address = $1", [addr]);
    const available = parseFloat(lender.rows[0]?.deposited_amount || "0") - parseFloat(lender.rows[0]?.active_amount || "0");
    if (amount > available && available > 0) {
      return res.status(400).json({ error: `Insufficient balance. Available: $${available.toFixed(2)}` });
    }

    const invoice = await db.query(
      "SELECT * FROM invoices WHERE id = $1 AND status = 'auctioning'",
      [invoiceId]
    );
    if (!invoice.rows[0]) return res.status(404).json({ error: "No live auction found for this invoice" });

    const auctionId = invoice.rows[0].auction_id || null;

    const existing = await db.query(
      "SELECT * FROM bids WHERE invoice_id = $1 AND lender_address = $2",
      [invoiceId, addr]
    );

    if (existing.rows[0]) {
      await db.query(
        "UPDATE bids SET amount = $1, discount_bps = $2, auction_id = $3 WHERE invoice_id = $4 AND lender_address = $5",
        [amount, discountBps, auctionId, invoiceId, addr]
      );
      const updated = await db.query("SELECT * FROM bids WHERE invoice_id = $1 AND lender_address = $2", [invoiceId, addr]);
      return res.json({ message: "Bid updated", bid: updated.rows[0] });
    }

    const result = await db.query(
      `INSERT INTO bids (auction_id, invoice_id, lender_address, amount, discount_bps, status)
       VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
      [auctionId, invoiceId, addr, amount, discountBps]
    );
    res.status(201).json({ message: "Bid placed successfully", bid: result.rows[0] });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

lenderRoutes.get("/:address/portfolio", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const address = req.params.address.toLowerCase();

    const positions = await db.query(
      `SELECT b.id, b.invoice_id, b.amount, b.discount_bps, b.accepted, b.status,
              i.buyer_name, i.face_value, i.due_date, i.status as invoice_status,
              i.settled_amount, i.fx_rate
       FROM bids b JOIN invoices i ON b.invoice_id = i.id
       WHERE b.lender_address = $1 ORDER BY b.created_at DESC`,
      [address]
    );

    const totals = await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN b.accepted = true AND i.status = 'funded' THEN b.amount ELSE 0 END), 0) as active_deployed,
         COALESCE(SUM(CASE WHEN i.status = 'settled' THEN b.amount * b.discount_bps / 10000.0 ELSE 0 END), 0) as yield_earned,
         COUNT(CASE WHEN b.accepted = true THEN 1 END) as funded_invoices
       FROM bids b JOIN invoices i ON b.invoice_id = i.id
       WHERE b.lender_address = $1`,
      [address]
    );

    res.json({ positions: positions.rows, summary: totals.rows[0] });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
