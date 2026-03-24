"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Auction {
  id: number;
  buyer_name: string;
  face_value: string;
  currency: string;
  due_date: string;
  status: string;
}

interface FXRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  source: string;
}

interface LenderData {
  deposited_amount: string;
  active_amount: string;
  total_yield_earned: string;
}

interface MyBid {
  invoice_id: number;
  amount: string;
  discount_bps: number;
  status: string;
  accepted: boolean;
}

function n(v: string | number, d = 0) {
  const x = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(x)) return "0";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(x);
}

function daysLeft(due: string) {
  return Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
}

function Shimmer({ h = 52 }: { h?: number }) {
  return <div className="shimmer-box" style={{ height: h, marginBottom: 10 }} />;
}

const FIELD: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 8,
  fontSize: 13, fontFamily: "var(--font-sans)", outline: "none",
  backgroundColor: "#0f1224", border: "1px solid rgba(0,102,255,0.2)",
  color: "#dde4ff", WebkitTextFillColor: "#dde4ff",
  caretColor: "#4d90ff", transition: "border-color 0.14s",
};

function onFocus(e: React.FocusEvent<any>) {
  e.target.style.borderColor = "#0066FF";
  e.target.style.boxShadow = "0 0 0 3px rgba(0,102,255,0.15)";
}
function onBlur(e: React.FocusEvent<any>) {
  e.target.style.borderColor = "rgba(0,102,255,0.2)";
  e.target.style.boxShadow = "none";
}

export default function LenderPortal() {
  const { address, isConnected } = useAccount();
  const lenderAddr = address?.toLowerCase() || "";

  const [auctions, setAuctions]     = useState<Auction[]>([]);
  const [fxRates, setFxRates]       = useState<FXRate[]>([]);
  const [lenderData, setLenderData] = useState<LenderData | null>(null);
  const [myBids, setMyBids]         = useState<MyBid[]>([]);
  const [loading, setLoading]       = useState(true);

  const [depositAmount, setDepositAmount]   = useState("");
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositResult, setDepositResult]   = useState<"" | "success" | "error">("");
  const [depositMsg, setDepositMsg]         = useState("");

  const [cctpChain, setCctpChain]     = useState("ethereum-sepolia");
  const [cctpAmount, setCctpAmount]   = useState("");
  const [cctpLoading, setCctpLoading] = useState(false);
  const [cctpResult, setCctpResult]   = useState<"" | "success" | "error" | "info">("");
  const [cctpData, setCctpData]       = useState<any>(null);

  const [bidAmounts, setBidAmounts] = useState<Record<number, string>>({});
  const [bidRates, setBidRates]     = useState<Record<number, string>>({});
  const [bidding, setBidding]       = useState<number | null>(null);
  const [bidErrors, setBidErrors]   = useState<Record<number, string>>({});
  const [bidSuccess, setBidSuccess] = useState<Record<number, string>>("");

  const fetchData = useCallback(async () => {
    try {
      const [invRes, fxRes] = await Promise.all([
        fetch(`${API}/api/invoices?status=auctioning&limit=20`),
        fetch(`${API}/api/fx/rates`),
      ]);
      if (invRes.ok) { const d = await invRes.json(); setAuctions(d.data || []); }
      if (fxRes.ok) setFxRates(await fxRes.json());

      if (lenderAddr) {
        const lr = await fetch(`${API}/api/lenders/${lenderAddr}`);
        if (lr.ok) {
          const ld = await lr.json();
          setLenderData(ld);
          setMyBids(ld.bids || []);
        }
      }
    } catch {
      setAuctions([]);
    } finally {
      setLoading(false);
    }
  }, [lenderAddr]);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 10000);
    return () => clearInterval(t);
  }, [fetchData]);

  async function handleDeposit() {
    if (!isConnected) return;
    const amount = parseFloat(depositAmount);
    if (!amount || amount < 5) {
      setDepositResult("error");
      setDepositMsg("Minimum deposit is $5 USDC");
      return;
    }
    setDepositLoading(true); setDepositResult(""); setDepositMsg("");
    try {
      await fetch(`${API}/api/lenders/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: lenderAddr }),
      });
      const res = await fetch(`${API}/api/lenders/deposit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lenderAddress: lenderAddr, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Deposit failed");
      setDepositResult("success");
      setDepositMsg(`$${n(amount)} USDC added to your lending pool balance.`);
      setDepositAmount("");
      setTimeout(fetchData, 800);
    } catch (e: any) {
      setDepositResult("error");
      setDepositMsg(e.message);
    } finally {
      setDepositLoading(false);
    }
  }

  async function handleCCTP() {
    if (!isConnected) return;
    const amount = parseFloat(cctpAmount);
    if (!amount || amount < 5) return;
    setCctpLoading(true); setCctpResult("");
    try {
      const res = await fetch(`${API}/api/cctp/deposit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceChain: cctpChain, amount, recipientAddress: lenderAddr, senderAddress: lenderAddr }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "CCTP failed");
      setCctpData(data);
      setCctpResult("info");
    } catch {
      setCctpResult("error");
    } finally {
      setCctpLoading(false);
    }
  }

  async function placeBid(invoiceId: number) {
    if (!isConnected) return;
    const amount = parseFloat(bidAmounts[invoiceId] || "0");
    const discountPct = parseFloat(bidRates[invoiceId] || "0");
    if (!amount || !discountPct) return;
    setBidding(invoiceId);
    setBidErrors(p => ({ ...p, [invoiceId]: "" }));
    setBidSuccess(p => ({ ...p, [invoiceId]: "" }));
    try {
      await fetch(`${API}/api/lenders/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: lenderAddr }),
      });
      const res = await fetch(`${API}/api/lenders/bid`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lenderAddress: lenderAddr,
          invoiceId,
          amount,
          discountBps: Math.round(discountPct * 100),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bid failed");
      setBidSuccess(p => ({ ...p, [invoiceId]: `$${n(amount)} bid at ${discountPct}% saved` }));
      setBidAmounts(p => ({ ...p, [invoiceId]: "" }));
      setBidRates(p => ({ ...p, [invoiceId]: "" }));
      setTimeout(fetchData, 800);
    } catch (e: any) {
      setBidErrors(p => ({ ...p, [invoiceId]: e.message }));
    } finally {
      setBidding(null);
    }
  }

  const deposited  = parseFloat(lenderData?.deposited_amount || "0");
  const active     = parseFloat(lenderData?.active_amount || "0");
  const available  = Math.max(0, deposited - active);
  const yieldTotal = parseFloat(lenderData?.total_yield_earned || "0");

  const CARD: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "22px 24px",
  };

  if (!isConnected) {
    return (
      <div style={{ padding: "clamp(20px,4vw,36px) clamp(16px,4vw,40px)", maxWidth: 560, margin: "0 auto", paddingTop: "10vh" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "linear-gradient(145deg,#1a6bff 0%,#0040cc 100%)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", boxShadow: "0 0 24px rgba(0,102,255,0.4)" }}>
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none"><path d="M20 4L33 30H7L20 4Z" stroke="white" strokeWidth="2.5" strokeLinejoin="round" fill="none"/><path d="M12.5 25.5H27.5" stroke="white" strokeWidth="2.2" strokeLinecap="round"/></svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#dde4ff", marginBottom: 8 }}>Connect your wallet to lend</h1>
          <p style={{ fontSize: 14, color: "var(--text-2)", marginBottom: 28, lineHeight: 1.6 }}>
            Deposit USDC, bid on live invoice auctions, and earn yield when invoices settle.
          </p>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <ConnectButton />
          </div>
          <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 16 }}>Arc Testnet, chain 5042002.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "clamp(20px,4vw,36px) clamp(16px,4vw,40px)", maxWidth: 1100, margin: "0 auto" }}>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 28 }} className="fade-up">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 4, color: "#dde4ff" }}>Lender portal</h1>
          <p style={{ fontSize: 12, color: "var(--text-2)" }}>
            Wallet: <span style={{ fontFamily: "var(--font-mono)", color: "var(--arc-light)" }}>{address?.slice(0,8)}...{address?.slice(-6)}</span>
          </p>
        </div>
        <Link href="/lender/bids" className="btn-ghost" style={{ fontSize: 13 }}>My active bids</Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 24 }}>
        {loading ? [1,2,3,4].map(i => <Shimmer key={i} h={88}/>) : [
          { label: "Total deposited", value: `$${n(deposited)}`,    color: "#dde4ff" },
          { label: "Deployed",        value: `$${n(active)}`,       color: "var(--arc-light)" },
          { label: "Available",       value: `$${n(available)}`,    color: "var(--success)" },
          { label: "Yield earned",    value: `$${n(yieldTotal, 2)}`, color: "var(--warn)" },
        ].map(c => (
          <div key={c.label} className="stat-tile fade-up d1">
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--text-3)", marginBottom: 10 }}>{c.label}</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: c.color, fontFamily: "var(--font-mono)" }}>{c.value}</p>
          </div>
        ))}
      </div>

      {fxRates.length > 0 && (
        <div style={{ ...CARD, marginBottom: 20, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--arc-light)", letterSpacing: "0.05em" }}>CIRCLE STABLEFX</span>
          {fxRates.map(r => (
            <div key={`${r.fromCurrency}${r.toCurrency}`} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>{r.fromCurrency}/{r.toCurrency}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--success)", fontFamily: "var(--font-mono)" }}>{r.rate.toFixed(4)}</span>
              <span style={{ fontSize: 10, color: "var(--text-3)", background: "var(--surface-2)", padding: "1px 6px", borderRadius: 4 }}>{r.source === "circle" ? "live" : "sandbox"}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16, marginBottom: 24 }}>
        <div style={CARD}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: "#dde4ff" }}>Deposit USDC</h2>
          <p style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 16, lineHeight: 1.5 }}>Add funds to your Arc lending pool. Minimum $5 USDC.</p>
          {depositResult === "success" ? (
            <div className="success-box">
              <p style={{ fontWeight: 600, marginBottom: 4 }}>Deposit confirmed</p>
              <p style={{ fontSize: 12 }}>{depositMsg}</p>
              <button className="btn-ghost" style={{ marginTop: 10, fontSize: 12 }} onClick={() => setDepositResult("")}>Deposit again</button>
            </div>
          ) : (
            <>
              {depositResult === "error" && (
                <div style={{ background: "var(--danger-dim)", border: "1px solid rgba(255,71,87,0.2)", borderRadius: 8, padding: "10px 12px", marginBottom: 12, fontSize: 12, color: "var(--danger)" }}>{depositMsg}</div>
              )}
              <label className="label">Amount (USDC)</label>
              <div style={{ position: "relative", marginBottom: 12 }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", fontSize: 13, fontFamily: "var(--font-mono)", pointerEvents: "none" }}>$</span>
                <input style={{ ...FIELD, paddingLeft: 28 }} onFocus={onFocus} onBlur={onBlur} type="number" min="5" placeholder="100" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
              </div>
              <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={handleDeposit} disabled={depositLoading || !depositAmount || parseFloat(depositAmount) < 5}>
                {depositLoading ? <><span className="loading-spinner"/> Processing...</> : "Deposit on Arc"}
              </button>
            </>
          )}
        </div>

        <div style={CARD}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: "#dde4ff" }}>Cross-chain deposit via CCTP</h2>
          <p style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 16, lineHeight: 1.5 }}>Bridge testnet USDC to Arc from another testnet using Circle CCTP.</p>
          {cctpResult === "info" && cctpData ? (
            <div className="info-box">
              <p style={{ fontWeight: 600, color: "var(--arc-light)", marginBottom: 6 }}>CCTP transfer initiated</p>
              <p style={{ marginBottom: 4 }}>From: <strong>{cctpData.sourceChainLabel}</strong> to Arc Testnet</p>
              <p style={{ marginBottom: 4 }}>Amount: <strong>{cctpData.amount} USDC</strong></p>
              <p style={{ fontSize: 11, opacity: 0.8 }}>Estimated arrival: {cctpData.estimatedTime}</p>
              <button className="btn-ghost" style={{ marginTop: 10, fontSize: 12 }} onClick={() => { setCctpResult(""); setCctpData(null); }}>Bridge again</button>
            </div>
          ) : (
            <>
              <label className="label">Source testnet</label>
              <select style={{ ...FIELD, appearance: "none" as const, marginBottom: 10, backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%237d88a8' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 32 }}
                onFocus={onFocus} onBlur={onBlur} value={cctpChain} onChange={e => setCctpChain(e.target.value)}>
                <option value="ethereum-sepolia">Ethereum Sepolia</option>
                <option value="base-sepolia">Base Sepolia</option>
                <option value="arbitrum-sepolia">Arbitrum Sepolia</option>
              </select>
              <label className="label">Amount (USDC)</label>
              <div style={{ position: "relative", marginBottom: 12 }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", fontSize: 13, fontFamily: "var(--font-mono)", pointerEvents: "none" }}>$</span>
                <input style={{ ...FIELD, paddingLeft: 28 }} onFocus={onFocus} onBlur={onBlur} type="number" min="5" placeholder="50" value={cctpAmount} onChange={e => setCctpAmount(e.target.value)} />
              </div>
              <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={handleCCTP} disabled={cctpLoading || !cctpAmount || parseFloat(cctpAmount) < 5}>
                {cctpLoading ? <><span className="loading-spinner"/> Initiating...</> : "Initiate CCTP transfer"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="surface" style={{ overflow: "hidden", marginBottom: myBids.length > 0 ? 16 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid rgba(0,102,255,0.12)", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "#dde4ff" }}>Live auctions</h2>
            <p style={{ fontSize: 11, color: "var(--text-2)", marginTop: 2 }}>Bid amounts are shielded on Arc. Only you and the seller see your rate.</p>
          </div>
          <span className="badge badge-blue">{loading ? "Loading..." : `${auctions.length} active`}</span>
        </div>

        {loading ? (
          <div style={{ padding: "16px 24px" }}>{[1,2,3].map(i => <Shimmer key={i}/>)}</div>
        ) : auctions.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 6 }}>No live auctions right now</p>
            <p style={{ fontSize: 12, color: "var(--text-3)" }}>Submit an invoice from the seller portal to create one.</p>
          </div>
        ) : (
          <div>
            {auctions.map(auction => {
              const dl = daysLeft(auction.due_date);
              const existingBid = myBids.find(b => b.invoice_id === auction.id);
              const isBidding = bidding === auction.id;
              const successMsg = bidSuccess[auction.id];
              return (
                <div key={auction.id} style={{ padding: "18px 24px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", flexWrap: "wrap", gap: 16, justifyContent: "space-between" }}>
                    <div style={{ flex: "1 1 200px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "#dde4ff" }}>{auction.buyer_name}</p>
                        <span className="badge badge-gray">{auction.currency}</span>
                        {dl <= 7 && <span className="badge badge-yellow">{dl}d left</span>}
                      </div>
                      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-2)", flexWrap: "wrap" }}>
                        <span>Face value: <span style={{ fontWeight: 600, color: "#dde4ff", fontFamily: "var(--font-mono)" }}>${parseFloat(auction.face_value).toLocaleString()}</span></span>
                        <span>Due: {new Date(auction.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        {available > 0 && <span style={{ color: "var(--success)" }}>Available: ${n(available)}</span>}
                      </div>
                      {bidErrors[auction.id] && (
                        <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 6 }}>{bidErrors[auction.id]}</p>
                      )}
                      {successMsg && (
                        <div style={{ marginTop: 8, padding: "8px 12px", background: "var(--success-dim)", borderRadius: 7, border: "1px solid rgba(0,214,143,0.2)", fontSize: 12, color: "var(--success)" }}>
                          Bid saved: {successMsg}
                        </div>
                      )}
                      {existingBid && !successMsg && (
                        <div style={{ marginTop: 8, padding: "8px 12px", background: "var(--arc-dim)", borderRadius: 7, border: "1px solid rgba(0,102,255,0.2)", fontSize: 12, color: "var(--arc-light)" }}>
                          Your bid: ${n(existingBid.amount)} at {(existingBid.discount_bps / 100).toFixed(2)}% discount
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                      <div style={{ minWidth: 100 }}>
                        <label className="label">Amount ($)</label>
                        <input style={FIELD} onFocus={onFocus} onBlur={onBlur} type="number" min="5" placeholder="50"
                          value={bidAmounts[auction.id] || ""} onChange={e => setBidAmounts(p => ({ ...p, [auction.id]: e.target.value }))} />
                      </div>
                      <div style={{ minWidth: 80 }}>
                        <label className="label">Discount (%)</label>
                        <input style={FIELD} onFocus={onFocus} onBlur={onBlur} type="number" min="0.1" max="20" step="0.1" placeholder="2.4"
                          value={bidRates[auction.id] || ""} onChange={e => setBidRates(p => ({ ...p, [auction.id]: e.target.value }))} />
                      </div>
                      <button className="btn-primary" onClick={() => placeBid(auction.id)}
                        disabled={isBidding || !bidAmounts[auction.id] || !bidRates[auction.id]} style={{ whiteSpace: "nowrap" }}>
                        {isBidding ? <><span className="loading-spinner"/> Placing...</> : existingBid ? "Update bid" : "Place bid"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
