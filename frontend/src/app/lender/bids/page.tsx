"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api, fmt } from "@/lib/api";

interface BidRow {
  id: number; invoice_id: number; buyer_name: string;
  amount: string; discount_bps: number; accepted: boolean;
  status: string; created_at: string;
  face_value?: string; due_date?: string; settled_amount?: string;
}

const STATUS_MAP: Record<string, { label: string; badge: string }> = {
  accepted: { label: "Active",       badge: "badge-green"  },
  settled:  { label: "Settled",      badge: "badge-green"  },
  pending:  { label: "Auction live", badge: "badge-blue"   },
  outbid:   { label: "Outbid",       badge: "badge-red"    },
};

function Skeleton({ h = 52 }: { h?: number }) {
  return <div className="shimmer-box" style={{ height: h, marginBottom: 8 }} />;
}

export default function MyBids() {
  const { data: bids, isLoading } = useQuery<BidRow[]>({
    queryKey: ["my-bids"],
    queryFn: () => api.get("/lenders/0x0000000000000000000000000000000000000002/portfolio")
      .then((d: any) => d.positions || []),
    refetchInterval: 15_000,
  });

  const totalActive  = (bids || []).filter(b => b.accepted && b.status !== "settled").reduce((s, b) => s + parseFloat(b.amount || "0"), 0);
  const totalYield   = (bids || []).filter(b => b.status === "settled").reduce((s, b) => s + parseFloat(b.amount || "0") * (b.discount_bps / 10000), 0);
  const totalBids    = (bids || []).length;

  return (
    <div style={{ padding: "36px 40px", maxWidth: 960, margin: "0 auto" }}>

      <div style={{ marginBottom: 28 }} className="fade-up">
        <Link href="/lender" style={{ fontSize: 12, color: "var(--text-2)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          Lender portal
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 4 }}>My bids</h1>
        <p style={{ fontSize: 12, color: "var(--text-2)" }}>Track your capital across all invoice auctions</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Active capital", value: `$${fmt(totalActive, 0)}`,  color: "var(--arc-light)" },
          { label: "Total yield",    value: `$${fmt(totalYield, 2)}`,   color: "var(--success)" },
          { label: "Total bids",     value: String(totalBids),          color: "var(--text)" },
        ].map((c, i) => (
          <div key={c.label} className="stat-tile fade-up" style={{ animationDelay: `${i * 0.06}s`, animationFillMode: "forwards", opacity: 0 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 10 }}>{c.label}</p>
            <p className="mono" style={{ fontSize: 26, fontWeight: 800, color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="surface" style={{ overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-3)" }}>
          <h2 style={{ fontSize: 14, fontWeight: 600 }}>Bid history</h2>
        </div>

        {isLoading ? (
          <div style={{ padding: "16px 24px" }}>{[1,2,3,4].map(i => <Skeleton key={i} />)}</div>
        ) : !bids || bids.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 10 }}>No bids yet</p>
            <Link href="/lender" className="btn-primary" style={{ fontSize: 12 }}>Browse live auctions</Link>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                {["Invoice", "Amount", "Discount", "Yield", "Due date", "Status"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 24px", fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.07em", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bids.map(bid => {
                const s = STATUS_MAP[bid.status] || STATUS_MAP.pending;
                const yieldAmt = parseFloat(bid.amount || "0") * (bid.discount_bps / 10000);
                return (
                  <tr key={bid.id} className="table-row">
                    <td style={{ padding: "16px 24px" }}>
                      <p style={{ fontSize: 13, fontWeight: 600 }}>{bid.buyer_name || `Invoice #${bid.invoice_id}`}</p>
                      <p className="mono" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>INV-{String(bid.invoice_id).padStart(4,"0")}</p>
                    </td>
                    <td style={{ padding: "16px 24px" }}><span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>${fmt(bid.amount, 0)}</span></td>
                    <td style={{ padding: "16px 24px" }}><span className="mono" style={{ fontSize: 13 }}>{(bid.discount_bps / 100).toFixed(2)}%</span></td>
                    <td style={{ padding: "16px 24px" }}>
                      <span className="mono" style={{ fontSize: 13, color: yieldAmt > 0 ? "var(--success)" : "var(--text-3)", fontWeight: yieldAmt > 0 ? 600 : 400 }}>
                        {yieldAmt > 0 ? `+$${fmt(yieldAmt, 2)}` : "—"}
                      </span>
                    </td>
                    <td style={{ padding: "16px 24px", fontSize: 12, color: "var(--text-2)" }}>
                      {bid.due_date ? new Date(bid.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </td>
                    <td style={{ padding: "16px 24px" }}><span className={`badge ${s.badge}`}>{s.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
