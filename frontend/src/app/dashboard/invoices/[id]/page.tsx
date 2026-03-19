"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, Invoice, STATUS, fmt, fmtDate, daysUntil, shortAddr } from "@/lib/api";

function Skeleton({ h = 40 }: { h?: number }) {
  return <div className="shimmer-box" style={{ height: h, borderRadius: 8, marginBottom: 8 }} />;
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: invoice, isLoading } = useQuery<Invoice>({
    queryKey: ["invoice", id],
    queryFn: () => api.get(`/invoices/${id}`),
    refetchInterval: 10_000,
  });

  const startAuction = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/start-auction`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoice", id] }),
  });

  const s = invoice ? (STATUS[invoice.status] || STATUS.pending) : null;
  const days = invoice ? daysUntil(invoice.due_date) : 0;

  return (
    <div style={{ padding: "36px 40px", maxWidth: 860, margin: "0 auto" }}>
      <div className="fade-up" style={{ marginBottom: 24 }}>
        <Link href="/dashboard/invoices" style={{ fontSize: 12, color: "var(--text-2)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          All invoices
        </Link>
        {isLoading ? <Skeleton h={60} /> : invoice && (
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>{invoice.buyer_name}</h1>
                {s && <span className={`badge ${s.badge}`}>{s.label}</span>}
              </div>
              <p className="mono" style={{ fontSize: 12, color: "var(--text-3)" }}>INV-{String(invoice.id).padStart(4, "0")} · {shortAddr(invoice.seller_address)}</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {invoice.status === "pending" && (
                <button className="btn-primary" onClick={() => startAuction.mutate()} disabled={startAuction.isPending}>
                  {startAuction.isPending ? "Starting..." : "Start auction"}
                </button>
              )}
              {invoice.status === "funded" && days <= 0 && (
                <Link href={`/settlement/${invoice.id}`} className="btn-primary">Trigger settlement</Link>
              )}
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div>{[1,2,3].map(i => <Skeleton key={i} h={80} />)}</div>
      ) : invoice && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Face value",    value: `$${fmt(invoice.face_value, 0)} ${invoice.currency}`, color: "var(--text)" },
              { label: "Advance paid",  value: invoice.advance_amount ? `$${fmt(invoice.advance_amount, 0)}` : "—", color: "var(--success)" },
              { label: "Discount rate", value: invoice.discount_bps ? `${(invoice.discount_bps / 100).toFixed(2)}%` : "—", color: "var(--text)" },
            ].map(c => (
              <div key={c.label} className="stat-tile">
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 8 }}>{c.label}</p>
                <p className="mono" style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{c.value}</p>
              </div>
            ))}
          </div>

          <div className="surface" style={{ padding: "20px 24px", marginBottom: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Invoice details</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 32px" }}>
              {[
                { k: "Due date",    v: fmtDate(invoice.due_date) },
                { k: "Days remaining", v: days > 0 ? `${days} days` : days === 0 ? "Due today" : `${Math.abs(days)} days overdue` },
                { k: "Created",    v: fmtDate(invoice.created_at) },
                { k: "Currency",   v: invoice.currency },
                { k: "Description", v: invoice.description || "—" },
                { k: "Token ID",   v: invoice.token_id ? `AINV-${invoice.token_id}` : "Not minted" },
              ].map(({ k, v }) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>{k}</span>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {invoice.ipfs_cid && (
            <div className="surface" style={{ padding: "20px 24px", marginBottom: 16 }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Document</h2>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div>
                  <p className="mono" style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 2 }}>IPFS CID</p>
                  <p className="mono" style={{ fontSize: 12 }}>{invoice.ipfs_cid}</p>
                </div>
                <a href={`http://localhost:8080/ipfs/${invoice.ipfs_cid}`} target="_blank" rel="noreferrer" className="btn-ghost" style={{ fontSize: 12, padding: "7px 14px" }}>View on IPFS</a>
              </div>
              {invoice.document_hash && (
                <p className="mono" style={{ fontSize: 10, color: "var(--text-3)", marginTop: 8 }}>On-chain hash: {invoice.document_hash.slice(0, 20)}...{invoice.document_hash.slice(-8)}</p>
              )}
            </div>
          )}

          {invoice.bids && invoice.bids.length > 0 && (
            <div className="surface" style={{ overflow: "hidden" }}>
              <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)" }}>
                <h2 style={{ fontSize: 13, fontWeight: 600 }}>Auction bids</h2>
                <p style={{ fontSize: 11, color: "var(--text-2)", marginTop: 2 }}>Bid amounts are shielded — showing discount rates only</p>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-2)" }}>
                    {["Lender", "Amount", "Discount", "Status", "Time"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 24px", fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoice.bids.map(bid => (
                    <tr key={bid.id} className="table-row">
                      <td style={{ padding: "14px 24px" }}><span className="mono" style={{ fontSize: 12 }}>{shortAddr(bid.lender_address)}</span></td>
                      <td style={{ padding: "14px 24px" }}><span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>${fmt(bid.amount, 0)}</span></td>
                      <td style={{ padding: "14px 24px" }}><span className="mono" style={{ fontSize: 13 }}>{(bid.discount_bps / 100).toFixed(2)}%</span></td>
                      <td style={{ padding: "14px 24px" }}>
                        <span className={`badge ${bid.accepted ? "badge-green" : "badge-gray"}`}>{bid.accepted ? "Accepted" : bid.status}</span>
                      </td>
                      <td style={{ padding: "14px 24px", fontSize: 12, color: "var(--text-2)" }}>{new Date(bid.created_at).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
