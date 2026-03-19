import { Pool } from "pg";

let pool: Pool;

export async function initDb() {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://dev:dev@localhost:5432/invoicedesk",
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      token_id INTEGER UNIQUE,
      seller_address VARCHAR(42) NOT NULL,
      seller_wallet_id VARCHAR(255),
      face_value NUMERIC NOT NULL,
      due_date TIMESTAMPTZ NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'USDC',
      buyer_name VARCHAR(255) NOT NULL,
      description TEXT,
      document_hash VARCHAR(66),
      ipfs_cid VARCHAR(255),
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      auction_id BIGINT,
      advance_amount NUMERIC,
      discount_bps INTEGER,
      settled_amount NUMERIC,
      fx_rate NUMERIC,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lenders (
      id SERIAL PRIMARY KEY,
      address VARCHAR(42) UNIQUE NOT NULL,
      wallet_id VARCHAR(255),
      deposited_amount NUMERIC DEFAULT 0,
      active_amount NUMERIC DEFAULT 0,
      total_yield_earned NUMERIC DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`ALTER TABLE lenders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bids (
      id SERIAL PRIMARY KEY,
      auction_id BIGINT,
      invoice_id INTEGER NOT NULL,
      lender_address VARCHAR(42) NOT NULL,
      amount NUMERIC NOT NULL,
      discount_bps INTEGER NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      accepted BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`ALTER TABLE bids ALTER COLUMN auction_id DROP NOT NULL`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS settlements (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER NOT NULL,
      auction_id BIGINT,
      payment_currency VARCHAR(10) NOT NULL,
      payment_amount NUMERIC NOT NULL,
      usdc_received NUMERIC NOT NULL,
      fx_rate NUMERIC,
      fee_collected NUMERIC,
      tx_hash VARCHAR(66),
      settled_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cctp_deposits (
      id SERIAL PRIMARY KEY,
      tx_hash VARCHAR(66) UNIQUE,
      source_chain VARCHAR(20) NOT NULL,
      destination_chain VARCHAR(20) DEFAULT 'arc',
      amount NUMERIC NOT NULL,
      recipient_address VARCHAR(42) NOT NULL,
      sender_address VARCHAR(42),
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shielded_bids (
      id SERIAL PRIMARY KEY,
      commitment VARCHAR(66) UNIQUE NOT NULL,
      invoice_id INTEGER NOT NULL,
      lender_address VARCHAR(42) NOT NULL,
      revealed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  console.log("Database initialized");
}

export function getDb() {
  if (!pool) throw new Error("Database not initialized");
  return pool;
}
