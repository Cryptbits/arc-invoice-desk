"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

function AppLogo({ size = 34 }: { size?: number }) {
  const r = Math.round(size * 0.25);
  return (
    <div style={{
      width: size, height: size, borderRadius: r, flexShrink: 0,
      background: "linear-gradient(145deg, #1a6bff 0%, #0040cc 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 0 20px rgba(0,102,255,0.5), inset 0 1px 0 rgba(255,255,255,0.18)",
    }}>
      <svg width={Math.round(size * 0.55)} height={Math.round(size * 0.55)} viewBox="0 0 40 40" fill="none">
        <path d="M20 4L33 30H7L20 4Z" stroke="white" strokeWidth="2.5" strokeLinejoin="round" fill="none"/>
        <path d="M12.5 25.5H27.5" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
        <path d="M17.5 19.5H22.5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    </div>
  );
}

const NAV = [
  {
    group: "Seller",
    items: [
      { href: "/dashboard", label: "Overview",
        icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="8" y="1" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="1" y="8" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="8" y="8" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/></svg> },
      { href: "/dashboard/invoices", label: "My invoices",
        icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 1.5H9.5L12 4V12.5H2.5V1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M9.5 1.5V4H12" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M4.5 7H9.5M4.5 9.5H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> },
      { href: "/dashboard/new-invoice", label: "New invoice",
        icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4"/><path d="M7 4.5V9.5M4.5 7H9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> },
    ],
  },
  {
    group: "Lender",
    items: [
      { href: "/lender", label: "Lend capital",
        icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4"/><path d="M5 7.5C5.5 8.5 6 9 7 9C8 9 8.5 8.5 9 7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M7 5V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> },
      { href: "/lender/bids", label: "Active bids",
        icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1.5 10.5L4.5 6.5L7.5 8.5L10 4.5L12.5 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg> },
    ],
  },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside style={{
      width: 224, flexShrink: 0,
      display: "flex", flexDirection: "column",
      background: "var(--surface)",
      borderRight: "1px solid var(--border)",
      padding: "18px 12px 20px",
    }}>
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 10px 22px", textDecoration: "none" }}>
        <AppLogo size={34} />
        <div>
          <p style={{ fontWeight: 800, fontSize: 13.5, letterSpacing: "-0.015em", color: "#dde4ff", lineHeight: 1.15 }}>Arc Invoice Desk</p>
          <p style={{ fontSize: 10, color: "var(--arc-light)", fontWeight: 600, letterSpacing: "0.05em", marginTop: 2 }}>BUILT ON ARC</p>
        </div>
      </Link>

      {NAV.map((group) => (
        <div key={group.group} style={{ marginBottom: 4 }}>
          <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--text-3)", padding: "3px 12px 6px" }}>
            {group.group}
          </p>
          {group.items.map((item) => {
            const active = path === item.href;
            return (
              <Link key={item.href} href={item.href} className={`nav-item${active ? " active" : ""}`}>
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}

      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10, padding: "0 2px" }}>
        <ConnectButton.Custom>
          {({ account, chain, openAccountModal, openConnectModal, mounted }) => {
            if (!mounted) return null;
            const connected = mounted && account && chain;
            return (
              <button
                onClick={connected ? openAccountModal : openConnectModal}
                style={{
                  width: "100%", padding: "10px 12px",
                  background: connected ? "rgba(0,214,143,0.08)" : "var(--arc-dim)",
                  border: `1px solid ${connected ? "rgba(0,214,143,0.2)" : "rgba(0,102,255,0.2)"}`,
                  borderRadius: 9, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                  transition: "all 0.14s", fontFamily: "var(--font-sans)",
                }}
              >
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: connected ? "var(--success)" : "var(--arc-light)", flexShrink: 0 }} />
                <div style={{ flex: 1, textAlign: "left" as const }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: connected ? "var(--success)" : "var(--arc-light)", lineHeight: 1 }}>
                    {connected ? account.displayName : "Connect wallet"}
                  </p>
                  {connected && chain && (
                    <p style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>{chain.name}</p>
                  )}
                </div>
              </button>
            );
          }}
        </ConnectButton.Custom>

        <a href="https://arc.network" target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
          <div style={{
            background: "var(--surface-2)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "11px 13px", cursor: "pointer", transition: "border-color 0.15s",
          }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(0,102,255,0.3)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <img src="/arc-official-logo.svg" alt="Arc Network" style={{ height: 14, display: "block", filter: "brightness(0) invert(1)", opacity: 0.9 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--success)", boxShadow: "0 0 6px var(--success)" }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: "var(--success)", letterSpacing: "0.04em" }}>LIVE</span>
              </div>
            </div>
            <p style={{ fontSize: 10, color: "var(--text-3)", lineHeight: 1.5 }}>Chain 5042002 · Testnet</p>
            <p style={{ fontSize: 10, color: "var(--text-3)" }}>Sub-second BFT finality</p>
          </div>
        </a>
      </div>
    </aside>
  );
}
