"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { api, Invoice, STATUS, fmt, fmtDate, daysUntil } from "@/lib/api";

const TABS = ["all", "pending", "auctioning", "funded", "settled"] as const;

function Skeleton() {
  return <div className="shimmer-box" style={{ height: 64, borderRadius: 8, marginBottom: 8 }} />;
}

export default function InvoicesPage() {
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<{ data: Invoice[]; total: number }>({
    queryKey: ["invoices", tab],
    queryFn: () => api.get(`/invoices?${tab !== "all" ? `status=${tab}&` : ""}limit=50`),
    refetchInterval: 15_000,
  });

  const invoices = (data?.data || []).filter(inv =>
    !search || inv.buyer_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: "36px 40px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }} className="fade-up">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 4 }}>My invoices</h1>
          <p style={{ fontSize: 12, color: "var(--text-2)" }}>{data?.total ?? 0} total</p>
        </div>
        <Link href="/dashboard/new-invoice" className="btn-primary">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1.5V11.5M1.5 6.5H11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          New invoice
        </Link>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }} className="fade-up d1">
        <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
          <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M9 9L11.5 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input className="input" style={{ paddingLeft: 36 }} placeholder="Search by buyer..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 2, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: 3 }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: "pointer",
              border: "none", background: tab === t ? "var(--arc)" : "transparent",
              color: tab === t ? "#fff" : "var(--text-2)", textTransform: "capitalize", transition: "all 0.12s",
            }}>{t}</button>
          ))}
        </div>
      </div>

      <div className="surface" style={{ overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: "16px 24px" }}>{[1,2,3,4].map(i => <Skeleton key={i} />)}</div>
        ) : invoices.length === 0 ? (
          <div style={{ padding: "56px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 12 }}>
              {search ? "No invoices match your search" : "No invoices yet"}
            </p>
            {!search && <Link href="/dashboard/new-invoice" className="btn-primary" style={{ fontSize: 12 }}>Submit your first invoice</Link>}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                {["Buyer", "Face value", "Due date", "Days left", "Status", "Advance", ""].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 24px", fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.07em", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => {
                const s = STATUS[inv.status] || STATUS.pending;
                const days = daysUntil(inv.due_date);
                return (
                  <tr key={inv.id} className="table-row">
                    <td style={{ padding: "16px 24px" }}>
                      <p style={{ fontSize: 13, fontWeight: 600 }}>{inv.buyer_name}</p>
                      <p className="mono" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>INV-{String(inv.id).padStart(4,"0")}</p>
                    </td>
                    <td style={{ padding: "16px 24px" }}><span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>${fmt(inv.face_value, 0)}</span></td>
                    <td style={{ padding: "16px 24px", fontSize: 13, color: "var(--text-2)" }}>{fmtDate(inv.due_date)}</td>
                    <td style={{ padding: "16px 24px" }}><span style={{ fontSize: 12, color: days <= 7 ? "var(--warn)" : "var(--text-2)" }}>{days}d</span></td>
                    <td style={{ padding: "16px 24px" }}><span className={`badge ${s.badge}`}>{s.label}</span></td>
                    <td style={{ padding: "16px 24px" }}><span className="mono" style={{ fontSize: 13, fontWeight: 600, color: inv.advance_amount ? "var(--success)" : "var(--text-3)" }}>{inv.advance_amount ? `$${fmt(inv.advance_amount, 0)}` : "—"}</span></td>
                    <td style={{ padding: "16px 24px" }}><Link href={`/dashboard/invoices/${inv.id}`} style={{ fontSize: 12, color: "var(--arc-light)", textDecoration: "none" }}>View</Link></td>
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
