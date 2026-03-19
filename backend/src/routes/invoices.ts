import { Router, Request, Response } from "express";
import { z } from "zod";
import { getDb } from "../services/db";
import { createWallet } from "../services/circle";
import { auctionQueue } from "../jobs/queue";

export const invoiceRoutes = Router();

const CreateInvoiceSchema = z.object({
  sellerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
  faceValue: z.number().positive("Face value must be positive"),
  dueDateTs: z.number().int().positive(),
  currency: z.enum(["USDC", "EURC"]).default("USDC"),
  buyerName: z.string().min(2, "Buyer name required"),
  description: z.string().optional(),
  documentHash: z.string().optional(),
  ipfsCid: z.string().optional(),
});

invoiceRoutes.get("/", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { seller, status, limit = "20", offset = "0" } = req.query;
    let query = "SELECT * FROM invoices WHERE 1=1";
    const params: unknown[] = [];

    if (seller) { params.push(seller); query += ` AND seller_address = $${params.length}`; }
    if (status)  { params.push(status);  query += ` AND status = $${params.length}`; }

    params.push(Math.min(parseInt(limit as string), 100));
    query += ` ORDER BY created_at DESC LIMIT $${params.length}`;
    params.push(parseInt(offset as string));
    query += ` OFFSET $${params.length}`;

    const result = await db.query(query, params);
    const countResult = await db.query(
      `SELECT COUNT(*) FROM invoices WHERE 1=1${seller ? " AND seller_address = $1" : ""}${status ? ` AND status = $${seller ? 2 : 1}` : ""}`,
      [seller, status].filter(Boolean)
    );

    res.json({ data: result.rows, total: countResult.rows[0].count, limit: parseInt(limit as string), offset: parseInt(offset as string) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

invoiceRoutes.get("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const result = await db.query("SELECT * FROM invoices WHERE id = $1", [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: "Invoice not found" });

    const bids = await db.query(
      "SELECT * FROM bids WHERE invoice_id = $1 ORDER BY discount_bps ASC, created_at ASC",
      [req.params.id]
    );
    res.json({ ...result.rows[0], bids: bids.rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

invoiceRoutes.post("/", async (req: Request, res: Response) => {
  const parsed = CreateInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors });
  }

  const data = parsed.data;
  const dueDate = new Date(data.dueDateTs * 1000);

  if (dueDate <= new Date()) {
    return res.status(400).json({ error: "Due date must be in the future" });
  }

  try {
    const db = getDb();

    const existing = await db.query(
      "SELECT wallet_id FROM lenders WHERE address = $1",
      [data.sellerAddress.toLowerCase()]
    );

    let walletId = existing.rows[0]?.wallet_id || null;

    if (!walletId && process.env.CIRCLE_WALLET_SET_ID) {
      const wallet = await createWallet(process.env.CIRCLE_WALLET_SET_ID, data.sellerAddress);
      if (wallet?.id) walletId = wallet.id;
    }

    const result = await db.query(
      `INSERT INTO invoices
        (seller_address, seller_wallet_id, face_value, due_date, currency, buyer_name, description, document_hash, ipfs_cid, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
       RETURNING *`,
      [
        data.sellerAddress.toLowerCase(),
        walletId,
        data.faceValue,
        dueDate.toISOString(),
        data.currency,
        data.buyerName,
        data.description || null,
        data.documentHash || null,
        data.ipfsCid || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

invoiceRoutes.post("/:id/start-auction", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const invoice = await db.query("SELECT * FROM invoices WHERE id = $1", [req.params.id]);

    if (!invoice.rows[0]) return res.status(404).json({ error: "Invoice not found" });
    if (invoice.rows[0].status !== "pending") {
      return res.status(400).json({ error: `Cannot start auction — invoice status is '${invoice.rows[0].status}'` });
    }

    await db.query("UPDATE invoices SET status = 'auctioning', updated_at = NOW() WHERE id = $1", [req.params.id]);
    await auctionQueue.add("create-auction", { invoiceId: parseInt(req.params.id) });

    res.json({ message: "Auction started", invoiceId: parseInt(req.params.id), status: "auctioning" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

invoiceRoutes.get("/:id/bids", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const result = await db.query(
      "SELECT * FROM bids WHERE invoice_id = $1 ORDER BY discount_bps ASC, created_at ASC",
      [req.params.id]
    );
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

invoiceRoutes.patch("/:id/cancel", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const invoice = await db.query("SELECT * FROM invoices WHERE id = $1", [req.params.id]);
    if (!invoice.rows[0]) return res.status(404).json({ error: "Invoice not found" });
    if (!["pending"].includes(invoice.rows[0].status)) {
      return res.status(400).json({ error: "Only pending invoices can be cancelled" });
    }
    await db.query("UPDATE invoices SET status = 'cancelled', updated_at = NOW() WHERE id = $1", [req.params.id]);
    res.json({ message: "Invoice cancelled" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
