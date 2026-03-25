import { Router, Request, Response } from "express";
import { z } from "zod";
import { getDb } from "../services/db";
import { getSwapQuote, executeStableFXSwap } from "../services/stablefx";

export const settlementRoutes = Router();

settlementRoutes.get("/quote/:invoiceId", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const invoice = await db.query("SELECT * FROM invoices WHERE id = $1", [req.params.invoiceId]);
    if (!invoice.rows[0]) return res.status(404).json({ error: "Invoice not found" });
    const inv = invoice.rows[0];
    const paymentCurrency = (req.query.currency as string)?.toUpperCase() || inv.currency;
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
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

settlementRoutes.post("/execute", async (req: Request, res: Response) => {
  try {
    const parsed = z.object({
      invoiceId: z.number(),
      paymentCurrency: z.string().default("USDC"),
      paymentAmount: z.number().positive(),
      payerAddress: z.string().optional(),
      txHash: z.string().optional(),
    }).safeParse(req.body);

    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { invoiceId, paymentCurrency, paymentAmount, txHash } = parsed.data;
    const db = getDb();

    const invoiceRes = await db.query(
      "SELECT * FROM invoices WHERE id = $1 AND status NOT IN ('settled', 'cancelled')",
      [invoiceId]
    );
    if (!invoiceRes.rows[0]) {
      return res.status(404).json({ error: "Invoice not found or already settled" });
    }

    const inv = invoiceRes.rows[0];

    let usdcAmount = paymentAmount;
    let fxRate = 1.0;

    if (paymentCurrency !== "USDC") {
      const swap = await executeStableFXSwap({
        fromCurrency: paymentCurrency,
        toCurrency: "USDC",
        fromAmount: paymentAmount,
      });
      usdcAmount = swap.toAmount;
      fxRate = swap.rate;
    }

    const protocolFee = usdcAmount * 0.003;
    const netRepayment = usdcAmount - protocolFee;

    // Accept ALL bids on this invoice that are not yet accepted
    await db.query(
      "UPDATE bids SET accepted = true, status = 'accepted' WHERE invoice_id = $1 AND accepted = false",
      [invoiceId]
    );

    // Get all bids (now all accepted)
    const allBids = await db.query(
      "SELECT * FROM bids WHERE invoice_id = $1",
      [invoiceId]
    );

    let totalBidAmount = 0;
    for (const bid of allBids.rows) {
      totalBidAmount += parseFloat(bid.amount);
    }

    // Distribute yield to each lender proportional to their bid
    for (const bid of allBids.rows) {
      const bidAmount = parseFloat(bid.amount);
      const yieldAmount = bidAmount * (bid.discount_bps / 10000);
      const proportion = totalBidAmount > 0 ? bidAmount / totalBidAmount : 0;
      const repayment = netRepayment * proportion;

      await db.query(
        `UPDATE lenders 
         SET active_amount = GREATEST(0, active_amount - $1),
             total_yield_earned = total_yield_earned + $2,
             updated_at = NOW()
         WHERE address = $3`,
        [bidAmount, yieldAmount, bid.lender_address]
      );

      console.log(`[Settlement] Lender ${bid.lender_address} — repaid $${repayment.toFixed(2)} + yield $${yieldAmount.toFixed(2)}`);
    }

    const auctionId = inv.auction_id || Date.now();

    await db.query(
      `UPDATE invoices SET status = 'settled', settled_amount = $1, fx_rate = $2, updated_at = NOW() WHERE id = $3`,
      [netRepayment, fxRate, invoiceId]
    );

    await db.query(
      `INSERT INTO settlements (invoice_id, auction_id, payment_currency, payment_amount, usdc_received, fx_rate, fee_collected, tx_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [invoiceId, auctionId, paymentCurrency, paymentAmount, usdcAmount, fxRate, protocolFee, txHash || null]
    );

    console.log(`[Settlement] Invoice ${invoiceId} settled — $${netRepayment.toFixed(2)} USDC, ${allBids.rows.length} lender(s) paid`);

    res.json({
      success: true,
      invoiceId,
      status: "settled",
      paymentCurrency,
      paymentAmount,
      usdcRepaid: parseFloat(netRepayment.toFixed(2)),
      fxRate: parseFloat(fxRate.toFixed(4)),
      feeCollected: parseFloat(protocolFee.toFixed(2)),
      lendersPaid: allBids.rows.length,
      totalYieldPaid: parseFloat(allBids.rows.reduce((s: number, b: any) => s + parseFloat(b.amount) * (b.discount_bps / 10000), 0).toFixed(2)),
    });
  } catch (e: any) {
    console.error("[Settlement] Error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

settlementRoutes.get("/status/:invoiceId", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const invoice = await db.query("SELECT * FROM invoices WHERE id = $1", [req.params.invoiceId]);
    if (!invoice.rows[0]) return res.status(404).json({ error: "Not found" });
    const settlement = await db.query(
      "SELECT * FROM settlements WHERE invoice_id = $1 ORDER BY settled_at DESC LIMIT 1",
      [req.params.invoiceId]
    );
    res.json({ invoice: invoice.rows[0], settlement: settlement.rows[0] || null });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

settlementRoutes.get("/history", async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const result = await db.query(
      `SELECT s.*, i.buyer_name, i.seller_address, i.currency
       FROM settlements s JOIN invoices i ON s.invoice_id = i.id
       ORDER BY s.settled_at DESC LIMIT 50`
    );
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
