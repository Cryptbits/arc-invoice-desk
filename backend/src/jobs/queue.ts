import Bull from "bull";
import { getDb } from "../services/db";
import { executeStableFXSwap } from "../services/stablefx"; // already imported from "../services/stablefx";

export let auctionQueue: Bull.Queue;
export let settlementQueue: Bull.Queue;
export let schedulerQueue: Bull.Queue;

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const AUCTION_DURATION_MS = 24 * 60 * 60 * 1000;

export async function initQueue() {
  auctionQueue   = new Bull("auction-jobs",   REDIS_URL);
  settlementQueue = new Bull("settlement-jobs", REDIS_URL);
  schedulerQueue  = new Bull("scheduler-jobs",  REDIS_URL, {
    defaultJobOptions: { removeOnComplete: 100, removeOnFail: 50 },
  });

  // ── create-auction ──────────────────────────────────────────────────
  auctionQueue.process("create-auction", async (job) => {
    const { invoiceId } = job.data;
    const db = getDb();
    const endTime = new Date(Date.now() + AUCTION_DURATION_MS);

    await db.query(
      `UPDATE invoices SET status = 'auctioning', updated_at = NOW() WHERE id = $1`,
      [invoiceId]
    );

    await auctionQueue.add("clear-auction", { invoiceId }, { delay: AUCTION_DURATION_MS });
    console.log(`[Auction] Started for invoice ${invoiceId} — ends ${endTime.toISOString()}`);
  });

  // ── clear-auction ───────────────────────────────────────────────────
  auctionQueue.process("clear-auction", async (job) => {
    const { invoiceId } = job.data;
    const db = getDb();

    const invoiceResult = await db.query(
      "SELECT * FROM invoices WHERE id = $1 AND status = 'auctioning'",
      [invoiceId]
    );
    if (!invoiceResult.rows[0]) return;

    const invoice = invoiceResult.rows[0];
    const targetAmount = parseFloat(invoice.face_value);

    const bids = await db.query(
      "SELECT * FROM bids WHERE invoice_id = $1 ORDER BY discount_bps ASC, created_at ASC",
      [invoiceId]
    );

    if (bids.rows.length === 0) {
      await db.query("UPDATE invoices SET status = 'pending', updated_at = NOW() WHERE id = $1", [invoiceId]);
      console.log(`[Auction] Invoice ${invoiceId} — no bids, returned to pending`);
      return;
    }

    let raised = 0;
    let clearingDiscount = 0;

    for (const bid of bids.rows) {
      if (raised >= targetAmount) break;
      const fill = Math.min(parseFloat(bid.amount), targetAmount - raised);
      raised += fill;
      clearingDiscount = bid.discount_bps;
      await db.query(
        "UPDATE bids SET accepted = true, status = 'accepted', amount = $1 WHERE id = $2",
        [fill, bid.id]
      );
      await db.query(
        "UPDATE lenders SET active_amount = active_amount + $1 WHERE address = $2",
        [fill, bid.lender_address]
      );
    }

    const advanceAmount = raised * (1 - clearingDiscount / 10000);
    const auctionId = Date.now();

    await db.query(
      `UPDATE invoices SET status = 'funded', advance_amount = $1, discount_bps = $2, auction_id = $3, updated_at = NOW() WHERE id = $4`,
      [advanceAmount, clearingDiscount, auctionId, invoiceId]
    );

    console.log(`[Auction] Invoice ${invoiceId} cleared — $${advanceAmount.toFixed(2)} USDC advance at ${clearingDiscount}bps`);
  });

  // ── execute-settlement ──────────────────────────────────────────────
  settlementQueue.process("execute-settlement", async (job) => {
    const { invoiceId, auctionId, paymentCurrency, paymentAmount } = job.data;
    const db = getDb();

    const invoiceResult = await db.query(
      "SELECT * FROM invoices WHERE id = $1 AND status = 'funded'", [invoiceId]
    );
    if (!invoiceResult.rows[0]) return;

    let usdcAmount = paymentAmount;
    let fxRate = 1.0;
    let txHash = null;

    if (paymentCurrency !== "USDC") {
      console.log(`[Settlement] Converting ${paymentAmount} ${paymentCurrency} via StableFX`);
      const swap = await executeStableFXSwap({
        fromCurrency: paymentCurrency,
        toCurrency: "USDC",
        fromAmount: paymentAmount,
        minToAmount: paymentAmount * 0.995,
        walletId: invoiceResult.rows[0].seller_wallet_id || "demo",
      });
      usdcAmount = swap.toAmount;
      fxRate = swap.rate;
      txHash = swap.txHash;
      console.log(`[Settlement] StableFX — received ${usdcAmount} USDC at rate ${fxRate}`);
    }

    const protocolFee = usdcAmount * 0.003;
    const netRepayment = usdcAmount - protocolFee;

    const acceptedBids = await db.query(
      "SELECT * FROM bids WHERE invoice_id = $1 AND accepted = true", [invoiceId]
    );

    for (const bid of acceptedBids.rows) {
      const yieldAmount = parseFloat(bid.amount) * (bid.discount_bps / 10000);
      await db.query(
        `UPDATE lenders SET active_amount = active_amount - $1, total_yield_earned = total_yield_earned + $2 WHERE address = $3`,
        [bid.amount, yieldAmount, bid.lender_address]
      );
    }

    await db.query(
      `UPDATE invoices SET status = 'settled', settled_amount = $1, fx_rate = $2, updated_at = NOW() WHERE id = $3`,
      [netRepayment, fxRate, invoiceId]
    );

    await db.query(
      `INSERT INTO settlements (invoice_id, auction_id, payment_currency, payment_amount, usdc_received, fx_rate, fee_collected, tx_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [invoiceId, auctionId, paymentCurrency, paymentAmount, usdcAmount, fxRate, protocolFee, txHash]
    );

    console.log(`[Settlement] Invoice ${invoiceId} settled — $${netRepayment.toFixed(2)} USDC to lenders`);
  });

  // ── distribute-repayment (legacy) ───────────────────────────────────
  settlementQueue.process("distribute-repayment", async (job) => {
    const { invoiceId } = job.data;
    const db = getDb();
    const bids = await db.query(
      "SELECT * FROM bids WHERE invoice_id = $1 AND accepted = true", [invoiceId]
    );
    for (const bid of bids.rows) {
      const y = parseFloat(bid.amount) * (bid.discount_bps / 10000);
      await db.query(
        `UPDATE lenders SET active_amount = active_amount - $1, total_yield_earned = total_yield_earned + $2 WHERE address = $3`,
        [bid.amount, y, bid.lender_address]
      );
    }
  });

  auctionQueue.on("failed",    (j, e) => console.error(`[Queue] ${j.name} #${j.id} failed:`, e.message));
  settlementQueue.on("failed", (j, e) => console.error(`[Queue] ${j.name} #${j.id} failed:`, e.message));

  console.log("Job queues initialized");
}
