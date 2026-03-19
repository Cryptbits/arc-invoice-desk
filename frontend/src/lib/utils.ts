const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

export function formatCurrency(value: number | string, currency = "USDC"): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num) + " " + currency;
}

export function formatAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function daysUntil(date: string | Date): number {
  const now = Date.now();
  const target = new Date(date).getTime();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

export function discountBpsToPercent(bps: number): string {
  return (bps / 100).toFixed(2) + "%";
}

export const STATUS_MAP: Record<string, { label: string; badge: string }> = {
  pending: { label: "Pending", badge: "badge-gray" },
  auctioning: { label: "Live Auction", badge: "badge-blue" },
  funded: { label: "Funded", badge: "badge-green" },
  settled: { label: "Settled", badge: "badge-green" },
  defaulted: { label: "Defaulted", badge: "badge-red" },
};
