"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { api, Metrics, Invoice, STATUS, fmt, fmtDate, daysUntil } from "@/lib/api";

function Tile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="stat-tile fade-up" style={{ animationFillMode: "forwards" }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 10 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 2, color: color || "var(--text)" }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "var(--text-3)" }}>{sub}</p>}
    </div>
  );
}

function Skeleton({ h = 40 }: { h?: number }) {
  return <div className="shimmer-box" style={{ height: h, borderRadius: 8, marginBottom: 8 }} />;
}

export default function Dashboard() {
  const { data: metrics, isLoading: mLoading } = useQuery<Metrics>({
    queryKey: ["metrics"],
    queryFn: () => api.get("/metrics/overview"),
    refetchInterval: 20_000,
  });

  const { data: invoiceData, isLoading: iLoading } = useQuery<{ data: Invoice[]; total: number }>({
    queryKey: ["invoices-dashboard"],
    queryFn: () => api.get("/invoices?limit=5"),
    refetchInterval: 15_000,
  });

  const inv = metrics?.invoices;
  const invoices = invoiceData?.data || [];
  const chartData = metrics?.volumeHistory?.map(v => ({
    date: new Date(v.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    volume: parseFloat(v.volume) || 0,
  })) || [];

  return (
    <div style={{ padding: "36px 40px", maxWidth: 1100, margin: "0 auto" }}>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32 }} className="fade-up">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 4 }}>Seller overview</h1>
          <p className="live-indicator" style={{ fontSize: 12, color: "var(--text-2)" }}>Synced with Arc Network</p>
        </div>
        <Link href="/dashboard/new-invoice" className="btn-primary">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1.5V11.5M1.5 6.5H11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          New invoice
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {mLoading ? [1,2,3,4].map(i => <Skeleton key={i} h={88} />) : <>
          <Tile label="Total face value"  value={inv ? `$${fmt(parseFloat(inv.total_face_value || "0") / 1000, 1)}K` : "—"} sub="invoices submitted" color="var(--arc-light)" />
          <Tile label="Capital advanced"  value={inv ? `$${fmt(parseFloat(inv.total_advanced || "0") / 1000, 1)}K` : "—"} sub="disbursed USDC" />
          <Tile label="Avg discount rate" value={inv ? `${(parseFloat(inv.avg_discount_bps || "0") / 100).toFixed(2)}%` : "—"} sub="clearing rate" />
          <Tile label="Active auctions"   value={inv?.auctioning_count || "0"} sub="accepting bids now" />
        </>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16, marginBottom: 24 }}>
        <div className="surface" style={{ padding: "24px 28px" }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Invoice volume</h2>
          <p style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 20 }}>Last 30 days</p>
          {mLoading ? <Skeleton h={160} /> : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData} margin={{ left: -16, right: 0, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.3}/>
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: "#4a4946", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#4a4946", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, fontFamily: "var(--font-sans)" }} labelStyle={{ color: "var(--text-2)" }} itemStyle={{ color: "var(--arc-light)" }} formatter={(v: number) => [`$${(v/1000).toFixed(1)}k`, "Volume"]} />
                <Area type="monotone" dataKey="volume" stroke="#2563eb" strokeWidth={2} fill="url(#vg)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="surface" style={{ padding: "24px" }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>Recent activity</h2>
          {mLoading ? [1,2,3,4,5].map(i => <Skeleton key={i} h={28} />) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {(metrics?.recentActivity || []).slice(0, 6).map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: a.type === "settlement" ? "var(--success)" : "var(--arc-light)", marginTop: 5, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 12, lineHeight: 1.4 }}>{a.label}</p>
                    <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>${fmt(a.amount, 0)} USDC</p>
                  </div>
                </div>
              ))}
              {(!metrics?.recentActivity || metrics.recentActivity.length === 0) && (
                <p style={{ fontSize: 12, color: "var(--text-3)" }}>No activity yet</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="surface" style={{ overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: 14, fontWeight: 600 }}>Recent invoices</h2>
          <Link href="/dashboard/invoices" style={{ fontSize: 12, color: "var(--arc-light)", textDecoration: "none" }}>View all</Link>
        </div>
        <div style={{ overflowX: "auto" }}>
          {iLoading ? (
            <div style={{ padding: "16px 24px" }}>{[1,2,3].map(i => <Skeleton key={i} h={52} />)}</div>
          ) : invoices.length === 0 ? (
            <div style={{ padding: "40px 24px", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 12 }}>No invoices yet</p>
              <Link href="/dashboard/new-invoice" className="btn-primary" style={{ fontSize: 12 }}>Submit your first invoice</Link>
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
                {invoices.map((inv) => {
                  const s = STATUS[inv.status] || STATUS.pending;
                  const days = daysUntil(inv.due_date);
                  return (
                    <tr key={inv.id} className="table-row">
                      <td style={{ padding: "16px 24px" }}>
                        <p style={{ fontSize: 13, fontWeight: 600 }}>{inv.buyer_name}</p>
                        <p className="mono" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>INV-{String(inv.id).padStart(4, "0")}</p>
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
    </div>
  );
}
