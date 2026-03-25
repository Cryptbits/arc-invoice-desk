"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { api, Invoice, fmt, fmtDate } from "@/lib/api";

interface SettleResult {
  success: boolean;
  invoiceId: number;
  status: string;
  paymentCurrency: string;
  paymentAmount: number;
  usdcRepaid: number;
  fxRate: number;
  feeCollected: number;
  lendersPaid: number;
  totalYieldPaid: number;
}

export default function SettlementPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [currency, setCurrency] = useState("USDC");
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<SettleResult | null>(null);

  const { data: invoice, isLoading } = useQuery<Invoice>({
    queryKey: ["invoice", id],
    queryFn: () => api.get(`/invoices/${id}`),
    refetchInterval: done ? false : 8000,
  });

  const { data: quote } = useQuery<{ toAmount: number; rate: number; estimatedUSDC: number }>({
    queryKey: ["settlement-quote", id, currency],
    queryFn: () => api.get(`/settlement/quote/${id}?currency=${currency}`),
    enabled: !!invoice && !done,
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
      setResult(data);
      setDone(true);
      // Immediately refresh all relevant data across the app
      qc.invalidateQueries({ queryKey: ["invoice", id] });
      qc.invalidateQueries({ queryKey: ["invoices-dashboard"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["metrics"] });
      qc.invalidateQueries({ queryKey: ["my-bids"] });
    },
    onError: (e: any) => {
      console.error("Settlement error:", e.message);
    },
  });

  if (done && result) {
    return (
      <div style={{ padding: "36px 40px", maxWidth: 580, margin: "0 auto" }}>
        <div style={{ textAlign: "center", paddingTop: 40, paddingBottom: 20 }} className="fade-up">
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "rgba(0,214,143,0.1)",
            border: "1px solid rgba(0,214,143,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
          }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M5 14L11 20L23 8" stroke="#00d68f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: "#dde4ff", letterSpacing: "-0.01em" }}>Invoice settled</h1>
          <p style={{ fontSize: 14, color: "var(--text-2)", marginBottom: 32, lineHeight: 1.6 }}>
            Payment received and distributed to lenders. This invoice is now closed.
          </p>

          <div className="surface" style={{ padding: "20px 24px", marginBottom: 16, textAlign: "left" }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--text-3)", marginBottom: 14 }}>Settlement summary</p>
            {[
              { k: "USDC distributed to lenders", v: `$${fmt(result.usdcRepaid, 2)}`, highlight: true },
              { k: "Payment currency", v: result.paymentCurrency, highlight: false },
              { k: "FX rate", v: result.paymentCurrency !== "USDC" ? `${result.fxRate.toFixed(4)} USDC per ${result.paymentCurrency}` : "1.0000 (no conversion)", highlight: false },
              { k: "Protocol fee (0.3%)", v: `$${fmt(result.feeCollected, 2)}`, highlight: false },
              { k: "Lenders paid", v: String(result.lendersPaid), highlight: false },
              { k: "Total yield distributed", v: `$${fmt(result.totalYieldPaid, 2)}`, highlight: true },
            ].map(({ k, v, highlight }) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>{k}</span>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", color: highlight ? "var(--success)" : "#dde4ff" }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <Link href="/dashboard" className="btn-primary" style={{ padding: "12px 28px" }}>Go to dashboard</Link>
            <Link href="/lender/bids" className="btn-ghost" style={{ padding: "12px 28px" }}>View lender yield</Link>
          </div>
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

      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, color: "#dde4ff" }}>Trigger settlement</h1>
      <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 28, lineHeight: 1.6 }}>
        The buyer pays the invoice. Circle StableFX converts the payment to USDC and lenders receive their principal plus yield.
      </p>

      {isLoading ? (
        <div className="shimmer-box" style={{ height: 200, borderRadius: 12 }} />
      ) : invoice ? (
        <>
          <div className="surface" style={{ padding: "20px 24px", marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--text-3)", marginBottom: 14 }}>Invoice details</p>
            {[
              { k: "Buyer", v: invoice.buyer_name },
              { k: "Face value", v: `$${fmt(invoice.face_value, 0)} ${invoice.currency}` },
              { k: "Due date", v: fmtDate(invoice.due_date) },
              { k: "Current status", v: (invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)) },
            ].map(({ k, v }) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>{k}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#dde4ff" }}>{v}</span>
              </div>
            ))}
          </div>

          <div className="surface" style={{ padding: "20px 24px", marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--text-3)", marginBottom: 14 }}>Payment currency</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {["USDC", "EURC"].map(c => (
                <button key={c} onClick={() => setCurrency(c)} style={{
                  flex: 1, padding: "11px 0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  background: currency === c ? "var(--arc)" : "var(--surface-2)",
                  color: currency === c ? "#fff" : "var(--text-2)",
                  border: `1px solid ${currency === c ? "var(--arc)" : "rgba(255,255,255,0.07)"}`,
                  transition: "all 0.12s",
                }}>{c}</button>
              ))}
            </div>

            {currency !== "USDC" && quote && (
              <div style={{ padding: "12px 14px", background: "var(--arc-dim)", borderRadius: 8, border: "1px solid rgba(0,102,255,0.2)" }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--arc-light)", marginBottom: 8 }}>Circle StableFX conversion</p>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "var(--text-2)" }}>Rate</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{quote.rate?.toFixed(4)} USDC per {currency}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "var(--text-2)" }}>Lenders receive</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--success)" }}>
                    ${fmt((quote.toAmount || quote.estimatedUSDC || 0) * 0.997, 2)} USDC
                  </span>
                </div>
              </div>
            )}
          </div>

          {settle.isError && (
            <div style={{ padding: "12px 14px", background: "var(--danger-dim)", border: "1px solid rgba(255,71,87,0.2)", borderRadius: 8, marginBottom: 14, fontSize: 12, color: "var(--danger)" }}>
              {(settle.error as any)?.message || "Settlement failed. Please try again."}
            </div>
          )}

          <div style={{ padding: "13px 16px", background: "var(--surface-2)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 20, fontSize: 12, color: "var(--text-2)", lineHeight: 1.65 }}>
            Settles atomically on Arc Network. {currency !== "USDC" ? "Circle StableFX converts before distributing to lenders. " : ""}Protocol fee is 0.3%.
          </div>

          <button
            className="btn-primary"
            style={{ width: "100%", justifyContent: "center", padding: "14px 0", fontSize: 14 }}
            onClick={() => settle.mutate()}
            disabled={settle.isPending}
          >
            {settle.isPending ? (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="loading-spinner" />
                Settling on Arc...
              </span>
            ) : `Settle with ${currency}`}
          </button>
        </>
      ) : (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <p style={{ color: "var(--text-2)" }}>Invoice not found</p>
          <Link href="/dashboard/invoices" className="btn-ghost" style={{ marginTop: 12, display: "inline-flex" }}>Back to invoices</Link>
        </div>
      )}
    </div>
  );
}
