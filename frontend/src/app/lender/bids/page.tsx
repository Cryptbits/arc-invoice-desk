"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { fmt } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface BidRow {
  id: number;
  invoice_id: number;
  buyer_name: string;
  amount: string;
  discount_bps: number;
  accepted: boolean;
  status: string;
  created_at: string;
  invoice_status?: string;
  face_value?: string;
  due_date?: string;
}

const STATUS_MAP: Record<string, { label: string; badge: string }> = {
  accepted:   { label: "Active",       badge: "badge-green" },
  settled:    { label: "Settled",      badge: "badge-green" },
  pending:    { label: "Auction live", badge: "badge-blue"  },
  outbid:     { label: "Outbid",       badge: "badge-red"   },
};

function Skeleton({ h = 52 }: { h?: number }) {
  return <div className="shimmer-box" style={{ height: h, marginBottom: 8 }} />;
}

export default function MyBids() {
  const { address, isConnected } = useAccount();

  const { data, isLoading } = useQuery<{ positions: BidRow[]; summary: any }>({
    queryKey: ["my-bids", address],
    queryFn: () => fetch(`${API}/api/lenders/${address?.toLowerCase()}/portfolio`).then(r => r.json()),
    enabled: !!address,
    refetchInterval: 10_000,
  });

  const bids = data?.positions || [];
  const summary = data?.summary;

  const totalActive  = parseFloat(summary?.active_deployed || "0");
  const totalYield   = parseFloat(summary?.yield_earned || "0");
  const totalFunded  = parseInt(summary?.funded_invoices || "0");

  if (!isConnected) {
    return (
      <div style={{ padding: "clamp(20px,4vw,36px) clamp(16px,4vw,40px)", maxWidth: 560, margin: "0 auto", paddingTop: "10vh", textAlign: "center" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#dde4ff", marginBottom: 8 }}>Connect your wallet</h1>
        <p style={{ fontSize: 14, color: "var(--text-2)", marginBottom: 24 }}>Connect to see your bids and yield</p>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <ConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "clamp(20px,4vw,36px) clamp(16px,4vw,40px)", maxWidth: 960, margin: "0 auto" }}>

      <div style={{ marginBottom: 28 }} className="fade-up">
        <Link href="/lender" style={{ fontSize: 12, color: "var(--text-2)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          Lender portal
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 4, color: "#dde4ff" }}>My bids</h1>
        <p style={{ fontSize: 12, color: "var(--text-2)" }}>
          Wallet: <span style={{ fontFamily: "var(--font-mono)", color: "var(--arc-light)" }}>{address?.slice(0,8)}...{address?.slice(-6)}</span>
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Active capital",    value: `$${fmt(totalActive, 0)}`,  color: "var(--arc-light)" },
          { label: "Total yield earned", value: `$${fmt(totalYield, 2)}`,  color: "var(--success)" },
          { label: "Funded invoices",    value: String(totalFunded),        color: "#dde4ff" },
          { label: "Total bids",         value: String(bids.length),        color: "var(--text-2)" },
        ].map((c, i) => (
          <div key={c.label} className="stat-tile fade-up" style={{ animationDelay: `${i * 0.06}s`, animationFillMode: "forwards", opacity: 0 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--text-3)", marginBottom: 10 }}>{c.label}</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: c.color, fontFamily: "var(--font-mono)" }}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="surface" style={{ overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(0,102,255,0.12)" }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#dde4ff" }}>Bid history</h2>
          <p style={{ fontSize: 11, color: "var(--text-2)", marginTop: 2 }}>All bids placed from your wallet. Updates every 10 seconds.</p>
        </div>

        {isLoading ? (
          <div style={{ padding: "16px 24px" }}>{[1,2,3,4].map(i => <Skeleton key={i} />)}</div>
        ) : bids.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 10 }}>No bids placed yet</p>
            <Link href="/lender" className="btn-primary" style={{ fontSize: 12 }}>Browse live auctions</Link>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                {["Invoice", "Amount", "Discount", "Yield earned", "Due date", "Status"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 24px", fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.07em", textTransform: "uppercase" as const }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bids.map(bid => {
                const invoiceStatus = bid.invoice_status || bid.status;
                const displayStatus = invoiceStatus === "settled" ? "settled" : bid.accepted ? "accepted" : "pending";
                const s = STATUS_MAP[displayStatus] || STATUS_MAP.pending;
                const yieldAmt = parseFloat(bid.amount || "0") * (bid.discount_bps / 10000);
                const isSettled = invoiceStatus === "settled";
                return (
                  <tr key={bid.id} className="table-row">
                    <td style={{ padding: "16px 24px" }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#dde4ff" }}>{bid.buyer_name || `Invoice #${bid.invoice_id}`}</p>
                      <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2, fontFamily: "var(--font-mono)" }}>INV-{String(bid.invoice_id).padStart(4, "0")}</p>
                    </td>
                    <td style={{ padding: "16px 24px" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)" }}>${fmt(bid.amount, 0)}</span>
                    </td>
                    <td style={{ padding: "16px 24px" }}>
                      <span style={{ fontSize: 13, fontFamily: "var(--font-mono)" }}>{(bid.discount_bps / 100).toFixed(2)}%</span>
                    </td>
                    <td style={{ padding: "16px 24px" }}>
                      <span style={{ fontSize: 13, fontWeight: isSettled ? 700 : 400, fontFamily: "var(--font-mono)", color: isSettled ? "var(--success)" : "var(--text-3)" }}>
                        {isSettled ? `+$${fmt(yieldAmt, 2)}` : "Pending settlement"}
                      </span>
                    </td>
                    <td style={{ padding: "16px 24px", fontSize: 12, color: "var(--text-2)" }}>
                      {bid.due_date ? new Date(bid.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </td>
                    <td style={{ padding: "16px 24px" }}>
                      <span className={`badge ${s.badge}`}>{s.label}</span>
                    </td>
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
