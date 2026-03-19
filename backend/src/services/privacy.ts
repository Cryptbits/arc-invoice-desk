import { createHash, randomBytes } from "crypto";

export interface PrivacyCommitment {
  commitment: string;
  salt: string;
  value: number;
  currency: string;
  createdAt: string;
}

export interface PrivacyReveal {
  commitment: string;
  salt: string;
  value: number;
  currency: string;
  verified: boolean;
}

const commitmentStore = new Map<string, PrivacyCommitment>();

export function createCommitment(value: number, currency: string): PrivacyCommitment {
  const salt = randomBytes(32).toString("hex");
  const payload = `${value}:${currency}:${salt}`;
  const commitment = "0x" + createHash("sha256").update(payload).digest("hex");

  const record: PrivacyCommitment = {
    commitment,
    salt,
    value,
    currency,
    createdAt: new Date().toISOString(),
  };

  commitmentStore.set(commitment, record);
  return record;
}

export function revealCommitment(
  commitment: string,
  salt: string,
  value: number,
  currency: string
): PrivacyReveal {
  const payload = `${value}:${currency}:${salt}`;
  const recomputed = "0x" + createHash("sha256").update(payload).digest("hex");
  const verified = recomputed === commitment;

  return {
    commitment,
    salt,
    value,
    currency,
    verified,
  };
}

export function verifyCommitment(
  commitment: string,
  value: number,
  currency: string,
  salt: string
): boolean {
  const payload = `${value}:${currency}:${salt}`;
  const expected = "0x" + createHash("sha256").update(payload).digest("hex");
  return expected === commitment;
}

export function getCommitment(commitment: string): PrivacyCommitment | null {
  return commitmentStore.get(commitment) || null;
}

export function createShieldedBid(
  lenderAddress: string,
  invoiceId: number,
  amount: number,
  discountBps: number
): { commitment: string; salt: string; publicData: Record<string, unknown> } {
  const salt = randomBytes(32).toString("hex");
  const payload = `${lenderAddress}:${invoiceId}:${amount}:${discountBps}:${salt}`;
  const commitment = "0x" + createHash("sha256").update(payload).digest("hex");

  commitmentStore.set(commitment, {
    commitment,
    salt,
    value: amount,
    currency: "USDC",
    createdAt: new Date().toISOString(),
  });

  return {
    commitment,
    salt,
    publicData: {
      lenderAddress,
      invoiceId,
      commitment,
      timestamp: new Date().toISOString(),
    },
  };
}

export function revealBid(
  commitment: string,
  lenderAddress: string,
  invoiceId: number,
  amount: number,
  discountBps: number,
  salt: string
): boolean {
  const payload = `${lenderAddress}:${invoiceId}:${amount}:${discountBps}:${salt}`;
  const recomputed = "0x" + createHash("sha256").update(payload).digest("hex");
  return recomputed === commitment;
}
