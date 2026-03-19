"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import { useWalletAddress } from "@/components/WalletButton";


const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type Step = "details" | "document" | "review" | "submitted";

const STEP_LABELS = ["Invoice details", "Document", "Review"];

export default function NewInvoice() {
  
  const [step, setStep] = useState<Step>("details");
  const [loading, setLoading] = useState(false);
  const [invoiceId, setInvoiceId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [ipfsCid, setIpfsCid] = useState("");
  const [uploadProgress, setUploadProgress] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    buyerName: "",
    buyerCountry: "",
    faceValue: "",
    currency: "USDC",
    dueDate: "",
    description: "",
    invoiceNumber: "",
  });

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const steps: Step[] = ["details", "document", "review", "submitted"];
  const stepIdx = steps.indexOf(step);
  const minDate = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];
  const walletAddress = useWalletAddress();
  const isConnected = walletAddress.length > 0;
  const sellerAddr = walletAddress || "0x0000000000000000000000000000000000000001";

  const fieldStyle = {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 8,
    fontSize: 13,
    fontFamily: "'Syne', sans-serif",
    outline: "none",
    border: "1px solid rgba(0,102,255,0.2)",
    backgroundColor: "#0f1224",
    color: "#dde4ff",
    WebkitTextFillColor: "#dde4ff",
    caretColor: "#4d90ff",
    transition: "border-color 0.14s, box-shadow 0.14s",
  } as React.CSSProperties;

  const labelStyle = {
    display: "block" as const,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.07em",
    textTransform: "uppercase" as const,
    color: "#7d88a8",
    marginBottom: 6,
  };

  function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    e.target.style.borderColor = "#0066FF";
    e.target.style.boxShadow = "0 0 0 3px rgba(0,102,255,0.15)";
    e.target.style.backgroundColor = "#111528";
  }
  function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    e.target.style.borderColor = "rgba(0,102,255,0.2)";
    e.target.style.boxShadow = "none";
    e.target.style.backgroundColor = "#0f1224";
  }

  function handleFileSelect(file: File | null) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError("File must be under 10MB"); return; }
    if (!file.type.includes("pdf") && !file.type.includes("image")) {
      setError("Please upload a PDF or image file"); return;
    }
    setSelectedFile(file);
    setError("");
  }

  async function uploadDocument(id: number) {
    if (!selectedFile && !form.invoiceNumber) return;
    setUploadProgress("uploading");
    try {
      if (selectedFile) {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const res = await fetch(`${API}/api/documents/upload/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/pdf" },
          body: arrayBuffer,
        });
        if (res.ok) {
          const data = await res.json();
          setIpfsCid(data.cid);
        }
      } else {
        const res = await fetch(`${API}/api/documents/upload/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invoiceNumber: form.invoiceNumber,
            buyerName: form.buyerName,
            faceValue: form.faceValue,
            currency: form.currency,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setIpfsCid(data.cid);
        }
      }
      setUploadProgress("done");
    } catch {
      setUploadProgress("error");
    }
  }

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const dueDateTs = Math.floor(new Date(form.dueDate).getTime() / 1000);
      const res = await fetch(`${API}/api/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerAddress: sellerAddr,
          faceValue: parseFloat(form.faceValue),
          dueDateTs,
          currency: form.currency,
          buyerName: form.buyerName + (form.buyerCountry ? `, ${form.buyerCountry}` : ""),
          description: form.description,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setInvoiceId(data.id);
      await uploadDocument(data.id);
      setStep("submitted");
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function canProceedDetails() {
    return form.buyerName.length >= 2 && parseFloat(form.faceValue) >= 100 && form.dueDate;
  }

  if (step === "submitted") {
    return (
      <div style={{ padding: "36px 40px", maxWidth: 560, margin: "0 auto" }}>
        <div style={{ textAlign: "center", padding: "48px 0" }} className="fade-up">
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(0,214,143,0.1)", border: "1px solid rgba(0,214,143,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M5 14L11 20L23 8" stroke="#00d68f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: "#dde4ff" }}>Invoice submitted</h2>
          <p style={{ fontSize: 14, color: "var(--text-2)", marginBottom: 8 }}>
            Your invoice NFT has been minted on Arc Network.
          </p>
          {ipfsCid && (
            <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 28, fontFamily: "var(--font-mono)" }}>
              IPFS: {ipfsCid.slice(0, 12)}...{ipfsCid.slice(-8)}
            </p>
          )}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", marginBottom: 28, textAlign: "left" }}>
            <p style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 8 }}>What happens next</p>
            {["Auction opens for 24 hours", "Lenders compete to fund at the lowest rate", "You receive a USDC advance when auction clears", "Full repayment + yield distributed on due date"].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: "var(--arc-dim)", border: "1px solid rgba(0,102,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "var(--arc-light)" }}>{i + 1}</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-2)" }}>{s}</p>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <Link href="/dashboard" className="btn-primary">Go to dashboard</Link>
            {invoiceId && <Link href={`/dashboard/invoices/${invoiceId}`} className="btn-ghost">View invoice</Link>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "36px 40px", maxWidth: 620, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-2)", textDecoration: "none", marginBottom: 16 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          Dashboard
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 4, color: "#dde4ff" }}>Submit an invoice</h1>
        <p style={{ fontSize: 13, color: "var(--text-2)" }}>Tokenise your receivable and access instant USDC liquidity</p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 28 }}>
        {STEP_LABELS.map((label, i) => {
          const done = stepIdx > i;
          const active = stepIdx === i;
          return (
            <div key={label} style={{ display: "flex", alignItems: "center", flex: i < STEP_LABELS.length - 1 ? 1 : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                  background: done ? "#0066FF" : active ? "rgba(0,102,255,0.15)" : "var(--surface-2)",
                  color: done || active ? (done ? "#fff" : "#4d90ff") : "var(--text-3)",
                  border: `1px solid ${done ? "#0066FF" : active ? "rgba(0,102,255,0.3)" : "var(--border-w)"}`,
                  transition: "all 0.2s",
                }}>
                  {done ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4.5 7.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg> : i + 1}
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: active ? "#dde4ff" : done ? "var(--text-2)" : "var(--text-3)", whiteSpace: "nowrap" }}>{label}</span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div style={{ flex: 1, height: 1, background: done ? "#0066FF" : "var(--border-w)", margin: "0 12px", minWidth: 20, transition: "background 0.2s" }} />
              )}
            </div>
          );
        })}
      </div>

      {!isConnected && (
        <div className="warn-box" style={{ marginBottom: 16 }}>
          Connect your wallet above to link your address to this invoice. You can continue without connecting but the USDC advance will go to a default address.
        </div>
      )}

      {error && (
        <div style={{ background: "var(--danger-dim)", border: "1px solid rgba(255,71,87,0.2)", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 12, color: "var(--danger)" }}>
          {error}
        </div>
      )}

      {step === "details" && (
        <div className="form-card">
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Buyer company name</label>
            <input
              style={fieldStyle} onFocus={onFocus} onBlur={onBlur}
              placeholder="Acme Corporation Ltd"
              value={form.buyerName} onChange={e => set("buyerName", e.target.value)}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
            <div>
              <label style={labelStyle}>Country of buyer</label>
              <input
                style={fieldStyle} onFocus={onFocus} onBlur={onBlur}
                placeholder="e.g. United Kingdom"
                value={form.buyerCountry} onChange={e => set("buyerCountry", e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Invoice number</label>
              <input
                style={fieldStyle} onFocus={onFocus} onBlur={onBlur}
                placeholder="INV-2025-001"
                value={form.invoiceNumber} onChange={e => set("invoiceNumber", e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
            <div>
              <label style={labelStyle}>Face value</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", fontSize: 13, fontFamily: "var(--font-mono)", pointerEvents: "none" }}>$</span>
                <input
                  style={{ ...fieldStyle, paddingLeft: 28 }} onFocus={onFocus} onBlur={onBlur}
                  placeholder="50,000" type="number" min="100"
                  value={form.faceValue} onChange={e => set("faceValue", e.target.value)}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Currency</label>
              <select style={{ ...fieldStyle, paddingRight: 36, appearance: "none" as const, backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%237d88a8' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", cursor: "pointer" }}
                onFocus={onFocus} onBlur={onBlur}
                value={form.currency} onChange={e => set("currency", e.target.value)}>
                <option value="USDC">USDC</option>
                <option value="EURC">EURC</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Due date (minimum 3 days from today)</label>
            <input
              style={fieldStyle} onFocus={onFocus} onBlur={onBlur}
              type="date" min={minDate}
              value={form.dueDate} onChange={e => set("dueDate", e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Description of goods or services</label>
            <textarea
              style={{ ...fieldStyle, resize: "vertical", minHeight: 80, lineHeight: 1.6 } as React.CSSProperties}
              onFocus={onFocus} onBlur={onBlur}
              placeholder="Software development services, Q3 2025..."
              value={form.description} onChange={e => set("description", e.target.value)}
            />
          </div>

          <div className="info-box" style={{ marginBottom: 20 }}>
            <span style={{ color: "var(--arc-light)", fontWeight: 600 }}>Anti-fraud protection: </span>
            Invoices are scored before submission. Suspicious patterns — duplicate buyers, round numbers only, missing descriptions — are flagged for manual review.
          </div>

          <button
            className="btn-primary"
            style={{ width: "100%", justifyContent: "center", padding: "13px 0", fontSize: 14 }}
            onClick={() => setStep("document")}
            disabled={!canProceedDetails()}
          >
            Continue to document upload
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7H12M8 3L12 7L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      )}

      {step === "document" && (
        <div className="form-card">
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: "#dde4ff" }}>Upload invoice document</h2>
          <p style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 20 }}>PDF is stored on IPFS. Only the SHA-256 hash is recorded on-chain — no one can access your document without permission.</p>

          <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: "none" }} onChange={e => handleFileSelect(e.target.files?.[0] || null)} />

          <div
            className={`upload-zone${dragOver ? " drag-over" : ""}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files[0]); }}
            style={{ marginBottom: 16, cursor: "pointer" }}
          >
            {selectedFile ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--success-dim)", border: "1px solid rgba(0,214,143,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 2h7l4 4v9H3V2z" stroke="var(--success)" strokeWidth="1.4" strokeLinejoin="round"/><path d="M10 2v4h4" stroke="var(--success)" strokeWidth="1.4" strokeLinejoin="round"/></svg>
                </div>
                <div style={{ textAlign: "left" }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#dde4ff" }}>{selectedFile.name}</p>
                  <p style={{ fontSize: 11, color: "var(--text-3)" }}>{(selectedFile.size / 1024).toFixed(0)} KB</p>
                </div>
              </div>
            ) : (
              <>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--arc-dim)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2V12M9 2L5 6M9 2L13 6" stroke="var(--arc-light)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 14H16" stroke="var(--arc-light)" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#dde4ff", marginBottom: 4 }}>Drop your invoice PDF here</p>
                <p style={{ fontSize: 12, color: "var(--text-3)" }}>Or click to browse — PDF or image, max 10MB</p>
              </>
            )}
          </div>

          {selectedFile && (
            <button className="btn-ghost" style={{ fontSize: 12, marginBottom: 16, width: "100%", justifyContent: "center" }} onClick={() => { setSelectedFile(null); if (fileRef.current) fileRef.current.value = ""; }}>
              Remove file
            </button>
          )}

          <div style={{ borderTop: "1px solid var(--border-w)", paddingTop: 16, marginBottom: 20 }}>
            <p style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 10 }}>No PDF? Enter document details instead</p>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Invoice number</label>
              <input style={fieldStyle} onFocus={onFocus} onBlur={onBlur} placeholder="INV-2025-001" value={form.invoiceNumber} onChange={e => set("invoiceNumber", e.target.value)} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setStep("details")}>Back</button>
            <button className="btn-primary" style={{ flex: 2, justifyContent: "center" }} onClick={() => setStep("review")}>
              Review invoice
            </button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div>
          <div className="form-card" style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: "#dde4ff" }}>Invoice summary</h2>
            {[
              { k: "Buyer",       v: form.buyerName + (form.buyerCountry ? `, ${form.buyerCountry}` : "") },
              { k: "Invoice no.", v: form.invoiceNumber || "Not specified" },
              { k: "Face value",  v: `$${parseFloat(form.faceValue || "0").toLocaleString()} ${form.currency}` },
              { k: "Due date",    v: form.dueDate ? new Date(form.dueDate).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" }) : "" },
              { k: "Document",    v: selectedFile ? selectedFile.name : (form.invoiceNumber ? "Metadata only" : "None") },
              { k: "Your wallet", v: isConnected ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}` : "Not connected (default address)" },
            ].map(({ k, v }) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>{k}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: "#dde4ff", textAlign: "right", maxWidth: "60%" }}>{v}</span>
              </div>
            ))}
          </div>

          <div className="info-box" style={{ marginBottom: 16 }}>
            After submission, a 24-hour Dutch auction opens automatically. Lenders compete to fund your invoice at the best discount rate. You receive the USDC advance as soon as the auction clears.
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setStep("document")} disabled={loading}>Back</button>
            <button
              className="btn-primary"
              style={{ flex: 2, justifyContent: "center", padding: "13px 0", fontSize: 14 }}
              onClick={submit}
              disabled={loading}
            >
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="loading-spinner" />
                  Minting on Arc...
                </span>
              ) : "Submit to auction"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
