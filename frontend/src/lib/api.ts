const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

export const api = {
  get:    <T>(path: string) => request<T>(path),
  post:   <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export type Invoice = {
  id: number;
  token_id: number | null;
  seller_address: string;
  face_value: string;
  due_date: string;
  currency: string;
  buyer_name: string;
  description: string | null;
  document_hash: string | null;
  ipfs_cid: string | null;
  status: "pending" | "auctioning" | "funded" | "settled" | "defaulted";
  auction_id: number | null;
  advance_amount: string | null;
  discount_bps: number | null;
  settled_amount: string | null;
  fx_rate: string | null;
  created_at: string;
  bids?: Bid[];
};

export type Bid = {
  id: number;
  invoice_id: number;
  lender_address: string;
  amount: string;
  discount_bps: number;
  accepted: boolean;
  status: string;
  created_at: string;
};

export type Metrics = {
  invoices: {
    total_invoices: string;
    total_face_value: string;
    total_advanced: string;
    avg_discount_bps: string;
    pending_count: string;
    auctioning_count: string;
    funded_count: string;
    settled_count: string;
  };
  lenders: {
    total_lenders: string;
    total_deposits: string;
    total_yield_paid: string;
  };
  volumeHistory: { date: string; volume: string; count: string }[];
  recentActivity: { type: string; label: string; amount: string; ts: string }[];
};

export type FXRate = {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  source: string;
  timestamp: string;
};

export function fmt(value: string | number | null, decimals = 2): string {
  if (value == null) return "—";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function fmtDate(d: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(d));
}

export function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export function daysUntil(due: string): number {
  return Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
}

export const STATUS: Record<string, { label: string; badge: string }> = {
  pending:    { label: "Pending",      badge: "badge-gray"   },
  auctioning: { label: "Live auction", badge: "badge-blue"   },
  funded:     { label: "Funded",       badge: "badge-green"  },
  settled:    { label: "Settled",      badge: "badge-green"  },
  defaulted:  { label: "Defaulted",    badge: "badge-red"    },
};
