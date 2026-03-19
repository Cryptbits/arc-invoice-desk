"use client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { api, Invoice, fmt, fmtDate } from "@/lib/api";

export default function SettlementPage() {
  const { id } = useParams<{ id: string }>();
  const [currency, setCurrency] = useState("USDC");
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<{ usdcRepaid: number; fxRate: number; feeCollected: number } | null>(null);

  const { data: invoice, isLoading } = useQuery<Invoice>({
    queryKey: ["invoice", id],
    queryFn: () => api.get(`/invoices/${id}`),
  });

  const { data: quote } = useQuery<{ toAmount: number; rate: number; estimatedUSDC: number }>({
    queryKey: ["settlement-quote", id, currency],
    queryFn: () => api.get(`/settlement/quote/${id}?currency=${currency}`),
    enabled: !!invoice,
    refetchInterval: 30_000,
  });

  const settle = useMutation({
    mutationFn: () => api.post("/settlement/execute", {
      invoiceId: parseInt(id),
      paymentCurrency: currency,
      paymentAmount: parseFloat(invoice?.face_value || "0"),
      payerAddress: "0x0000000000000000000000000000000000000001",
    }),
    onSuccess: (data: any) => {
      setResult({ usdcRepaid: data.usdcRepaid || 0, fxRate: data.fxRate || 1, feeCollected: data.feeCollected || 0 });
      setDone(true);
    },
  });

  if (done && result) {
    return (
      <div style={{ padding: "36px 40px", maxWidth: 560, margin: "0 auto" }}>
        <div style={{ textAlign: "center", padding: "48px 0" }} className="fade-up">
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--success-dim)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", border: "1px solid rgba(34,197,94,0.3)" }}>
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M5 13L10 18L21 7" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Settlement complete</h1>
          <p style={{ fontSize: 14, color: "var(--text-2)", marginBottom: 32 }}>Invoice settled. Lenders have received principal and yield.</p>
          <div className="surface" style={{ padding: "20px 24px", marginBottom: 24, textAlign: "left" }}>
            {[
              { k: "USDC repaid to lenders", v: `$${fmt(result.usdcRepaid, 2)}` },
              { k: "FX rate used",           v: currency !== "USDC" ? result.fxRate.toFixed(4) : "1.0000" },
              { k: "Protocol fee (0.3%)",    v: `$${fmt(result.feeCollected, 2)}` },
              { k: "Settlement currency",    v: currency },
            ].map(({ k, v }) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>{k}</span>
                <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
          <Link href="/dashboard" className="btn-primary" style={{ width: "100%", justifyContent: "center" }}>Back to dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "36px 40px", maxWidth: 560, margin: "0 auto" }}>
      <Link href={`/dashboard/invoices/${id}`} style={{ fontSize: 12, color: "var(--text-2)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 24 }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        Back to invoice
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Trigger settlement</h1>
      <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 28 }}>Buyer pays the invoice. StableFX converts to USDC and lenders receive principal plus yield.</p>

      {isLoading ? <div className="shimmer-box" style={{ height: 200, borderRadius: 12 }} /> : invoice && (
        <>
          <div className="surface" style={{ padding: "20px 24px", marginBottom: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Invoice</h2>
            {[
              { k: "Buyer",      v: invoice.buyer_name },
              { k: "Face value", v: `$${fmt(invoice.face_value, 0)} ${invoice.currency}` },
              { k: "Due date",   v: fmtDate(invoice.due_date) },
            ].map(({ k, v }) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>{k}</span>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>

          <div className="surface" style={{ padding: "20px 24px", marginBottom: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Payment currency</h2>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {["USDC", "EURC"].map(c => (
                <button key={c} onClick={() => setCurrency(c)} style={{
                  flex: 1, padding: "10px 0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  background: currency === c ? "var(--arc)" : "var(--surface-2)",
                  color: currency === c ? "#fff" : "var(--text-2)",
                  border: `1px solid ${currency === c ? "var(--arc)" : "var(--border)"}`,
                  transition: "all 0.12s",
                }}>{c}</button>
              ))}
            </div>
            {quote && currency !== "USDC" && (
              <div style={{ padding: "12px 14px", background: "var(--arc-dim)", borderRadius: 8, border: "1px solid rgba(37,99,235,0.2)" }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--arc-light)", marginBottom: 6 }}>StableFX conversion</p>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "var(--text-2)" }}>Rate</span>
                  <span className="mono" style={{ fontWeight: 600 }}>{quote.rate?.toFixed(4)} USDC per {currency}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "var(--text-2)" }}>You receive</span>
                  <span className="mono" style={{ fontWeight: 600, color: "var(--success)" }}>${fmt(quote.toAmount || quote.estimatedUSDC, 2)} USDC</span>
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: "14px 16px", background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 20, fontSize: 12, color: "var(--text-2)", lineHeight: 1.6 }}>
            Executes atomically on Arc. {currency !== "USDC" ? "Circle StableFX converts your payment before distributing to lenders. " : ""}Protocol fee is 0.3%.
          </div>

          <button className="btn-primary" style={{ width: "100%", justifyContent: "center", padding: "14px 0", fontSize: 14 }} onClick={() => settle.mutate()} disabled={settle.isPending}>
            {settle.isPending ? "Settling on Arc..." : `Settle with ${currency}`}
          </button>
        </>
      )}
    </div>
  );
}
