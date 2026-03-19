"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface LiveStats {
  invoices: { total_invoices: string; total_face_value: string; auctioning_count: string; settled_count: string };
  lenders: { total_lenders: string; total_deposits: string };
}

const HOW = [
  { n: "01", title: "Tokenise", desc: "Upload your invoice. It is minted as an ERC-721 NFT on Arc Network, locking the face value and due date on-chain permanently." },
  { n: "02", title: "Auction",  desc: "A 24-hour Dutch auction opens immediately. Lenders compete to fund it at the lowest discount rate." },
  { n: "03", title: "Advance",  desc: "USDC hits your wallet the moment the auction clears. The agreed discount is deducted — the rest is yours." },
  { n: "04", title: "Settle",   desc: "On due date, the buyer pays in any stablecoin. Circle StableFX converts atomically to USDC. Lenders receive principal plus yield." },
];

const FEATURES = [
  {
    title: "Opt-in privacy for bids",
    desc: "Bid amounts are shielded on-chain during the auction window using Arc's opt-in privacy. Competitors cannot see your rate. Revealed only to counterparties at settlement.",
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 1.5L16.5 5.25V9C16.5 12.75 13.2 16.2 9 16.875C4.8 16.2 1.5 12.75 1.5 9V5.25L9 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M6 9L8 11L12 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    title: "Sub-second finality",
    desc: "Arc's Malachite BFT consensus confirms every transaction in under one second. No waiting for block confirmations. Settlement is instant.",
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.5"/><path d="M9 5V9.5L12 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  },
  {
    title: "Circle StableFX settlement",
    desc: "Buyers pay in EURC, USDC, or any supported stablecoin. Circle's StableFX converts atomically on Arc. Lenders always receive USDC — zero FX exposure.",
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9H15M11 5L15 9L11 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    title: "CCTP cross-chain deposits",
    desc: "Lenders deposit USDC from Ethereum, Base, or Arbitrum directly into the Arc pool using Circle CCTP. No manual bridging. Funds arrive in minutes.",
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="5.5" cy="9" r="3" stroke="currentColor" strokeWidth="1.5"/><circle cx="12.5" cy="9" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M8.5 9H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  },
];

export default function Landing() {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    fetch(`${API}/api/metrics/overview`)
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => null);
  }, []);

  const totalInvoices = stats?.invoices.total_invoices || "0";
  const activeAuctions = stats?.invoices.auctioning_count || "0";
  const settled = stats?.invoices.settled_count || "0";
  const lenders = stats?.lenders.total_lenders || "0";

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>

      <nav className="glass" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(145deg,#0066FF 0%,#0047CC 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 14px rgba(0,102,255,0.4)" }}>
            <svg width="15" height="15" viewBox="0 0 200 200" fill="none">
              <path d="M100 10L180 160H20L100 10Z" stroke="white" strokeWidth="16" strokeLinejoin="round" fill="none"/>
              <path d="M55 135H145" stroke="white" strokeWidth="14" strokeLinecap="round"/>
            </svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: 14, color: "#dde4ff", letterSpacing: "-0.01em" }}>Arc Invoice Desk</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link href="/dashboard" className="btn-ghost" style={{ fontSize: 12, padding: "8px 14px" }}>Seller portal</Link>
          <Link href="/lender" className="btn-primary" style={{ fontSize: 12, padding: "8px 14px" }}>Start lending</Link>
        </div>
      </nav>

      <section style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "120px 24px 80px", textAlign: "center", overflow: "hidden" }}>
        <div className="grid-bg" style={{ position: "absolute", inset: 0, opacity: 0.35 }} />
        <div style={{ position: "absolute", top: "45%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 350, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(0,102,255,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ position: "relative", maxWidth: 780, opacity: ready ? 1 : 0, transform: ready ? "none" : "translateY(16px)", transition: "all 0.65s ease" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 999, background: "var(--arc-dim)", border: "1px solid rgba(0,102,255,0.2)", marginBottom: 24 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", boxShadow: "0 0 6px var(--success)" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--arc-light)" }}>Live on Arc Testnet</span>
          </div>

          <h1 style={{ fontSize: "clamp(36px, 6vw, 70px)", fontWeight: 800, lineHeight: 1.04, letterSpacing: "-0.025em", marginBottom: 24, color: "#dde4ff" }}>
            Invoice discounting
            <br />
            <span style={{ color: "var(--arc-light)" }}>at settlement speed</span>
          </h1>

          <p style={{ fontSize: 18, color: "var(--text-2)", lineHeight: 1.65, maxWidth: 560, margin: "0 auto 36px" }}>
            Turn unpaid invoices into instant USDC liquidity. Lenders compete in Dutch auctions. Circle StableFX settles in any stablecoin, in under a second.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 60 }}>
            <Link href="/dashboard" className="btn-primary" style={{ fontSize: 14, padding: "13px 28px" }}>
              Finance an invoice
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7H12M8 3L12 7L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
            <Link href="/lender" className="btn-ghost" style={{ fontSize: 14, padding: "13px 28px" }}>Lend capital</Link>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", maxWidth: 600, margin: "0 auto", borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)", background: "var(--border)", gap: 1, opacity: ready ? 1 : 0, transition: "opacity 0.65s ease 0.3s" }}>
            {[
              { value: totalInvoices, label: "Invoices submitted" },
              { value: activeAuctions, label: "Live auctions" },
              { value: settled, label: "Settled" },
              { value: lenders, label: "Active lenders" },
            ].map((s) => (
              <div key={s.label} style={{ background: "var(--surface)", padding: "20px 16px" }}>
                <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", color: "#dde4ff", marginBottom: 4 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "80px 40px", maxWidth: 1060, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--arc-light)", marginBottom: 10 }}>THE FLOW</p>
          <h2 style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.015em", color: "#dde4ff" }}>Invoice to liquidity in four steps</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 4 }}>
          {HOW.map((step, i) => (
            <div key={step.n} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderLeft: i > 0 ? "none" : undefined, borderRadius: i === 0 ? "12px 0 0 12px" : i === HOW.length - 1 ? "0 12px 12px 0" : 0, padding: "26px 22px" }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: "var(--surface-3)", marginBottom: 14, letterSpacing: "-0.03em", fontFamily: "var(--font-mono)" }}>{step.n}</div>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: "#dde4ff" }}>{step.title}</h3>
              <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.65 }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: "0 40px 80px", maxWidth: 1060, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--arc-light)", marginBottom: 10 }}>BUILT ON ARC</p>
          <h2 style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.015em", color: "#dde4ff" }}>Infrastructure only Arc makes possible</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          {FEATURES.map((f) => (
            <div key={f.title} className="surface" style={{ padding: "26px" }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: "var(--arc-dim)", color: "var(--arc-light)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                {f.icon}
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "#dde4ff" }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ borderTop: "1px solid var(--border)", padding: "80px 40px", textAlign: "center" }}>
        <div style={{ marginBottom: 20 }}>
          <img src="/arc-official-logo.svg" alt="Arc Network" style={{ height: 32, display: "inline-block", opacity: 0.7 }} />
        </div>
        <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 14, color: "#dde4ff" }}>Ready to get started?</h2>
        <p style={{ fontSize: 16, color: "var(--text-2)", marginBottom: 32 }}>Submit your first invoice in under three minutes.</p>
        <Link href="/dashboard" className="btn-primary" style={{ fontSize: 15, padding: "14px 36px" }}>
          Open the desk
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7H12M8 3L12 7L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </Link>
      </section>

      <footer style={{ borderTop: "1px solid var(--border)", padding: "22px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: "var(--arc)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="11" height="11" viewBox="0 0 200 200" fill="none"><path d="M100 10L180 160H20L100 10Z" stroke="white" strokeWidth="20" strokeLinejoin="round" fill="none"/><path d="M55 135H145" stroke="white" strokeWidth="18" strokeLinecap="round"/></svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#dde4ff" }}>Arc Invoice Desk</span>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-3)" }}>Built on Arc Network · Powered by Circle StableFX · Testnet only</p>
      </footer>
    </div>
  );
}
