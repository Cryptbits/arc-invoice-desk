import { Router, Request, Response } from "express";
import { getDb } from "../services/db";

export const metricsRoutes = Router();

metricsRoutes.get("/overview", async (_req: Request, res: Response) => {
  const db = getDb();

  const [invoiceStats, lenderStats, settlementStats, recentActivity] = await Promise.all([
    db.query(`
      SELECT
        COUNT(*) as total_invoices,
        SUM(face_value) as total_face_value,
        SUM(CASE WHEN status = 'funded' THEN advance_amount ELSE 0 END) as total_advanced,
        SUM(CASE WHEN status = 'settled' THEN settled_amount ELSE 0 END) as total_settled,
        AVG(CASE WHEN discount_bps IS NOT NULL THEN discount_bps END) as avg_discount_bps,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'auctioning' THEN 1 END) as auctioning_count,
        COUNT(CASE WHEN status = 'funded' THEN 1 END) as funded_count,
        COUNT(CASE WHEN status = 'settled' THEN 1 END) as settled_count
      FROM invoices
    `),
    db.query(`
      SELECT
        COUNT(*) as total_lenders,
        SUM(deposited_amount) as total_deposits,
        SUM(active_amount) as total_active,
        SUM(total_yield_earned) as total_yield_paid
      FROM lenders
    `),
    db.query(`
      SELECT
        COUNT(*) as total_settlements,
        SUM(usdc_received) as total_usdc_settled,
        SUM(fee_collected) as total_fees,
        AVG(fx_rate) as avg_fx_rate
      FROM settlements
      WHERE settled_at > NOW() - INTERVAL '30 days'
    `),
    db.query(`
      SELECT
        'invoice' as type, buyer_name as label, face_value as amount, created_at as ts
      FROM invoices
      UNION ALL
      SELECT
        'settlement' as type, 'Settlement' as label, usdc_received as amount, settled_at as ts
      FROM settlements
      ORDER BY ts DESC
      LIMIT 10
    `),
  ]);

  const volumeHistory = await db.query(`
    SELECT
      DATE_TRUNC('day', created_at) as date,
      SUM(face_value) as volume,
      COUNT(*) as count
    FROM invoices
    WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY 1
    ORDER BY 1 ASC
  `);

  res.json({
    invoices: invoiceStats.rows[0],
    lenders: lenderStats.rows[0],
    settlements: settlementStats.rows[0],
    recentActivity: recentActivity.rows,
    volumeHistory: volumeHistory.rows,
  });
});

metricsRoutes.get("/fx-rates", async (_req: Request, res: Response) => {
  const pairs = [
    { from: "EURC", to: "USDC" },
    { from: "USDC", to: "EURC" },
  ];

  const rates = await Promise.all(
    pairs.map(async (pair) => {
      try {
        const response = await fetch(
          `https://api.circle.com/v1/stablefx/rates?from=${pair.from}&to=${pair.to}`,
          {
            headers: { Authorization: `Bearer ${process.env.CIRCLE_API_KEY}` },
          }
        );
        const data = await response.json();
        return { ...pair, rate: data.rate, timestamp: new Date().toISOString() };
      } catch {
        return { ...pair, rate: null, error: "Rate unavailable" };
      }
    })
  );

  res.json(rates);
});
