"use client";
import { useState, useEffect } from "react";

function shortAddr(addr: string) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export function WalletButton() {
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const eth = (window as any).ethereum;
    if (eth?.selectedAddress) setAddress(eth.selectedAddress);
    const handler = (accounts: string[]) => setAddress(accounts[0] || null);
    eth?.on("accountsChanged", handler);
    return () => eth?.removeListener("accountsChanged", handler);
  }, []);

  async function connect() {
    const eth = (window as any).ethereum;
    if (!eth) { alert("MetaMask not found. Please install it from metamask.io"); return; }
    setLoading(true);
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" }) as string[];
      setAddress(accounts[0]);
      try {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0x4CE452",
            chainName: "Arc Testnet",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://rpc.testnet.arc.network"],
            blockExplorerUrls: ["https://testnet.arcscan.app"],
          }],
        });
      } catch { }
    } catch { }
    finally { setLoading(false); }
  }

  if (!mounted) return (
    <div style={{ width: "100%", padding: "10px 12px", background: "rgba(0,102,255,0.06)", border: "1px solid rgba(0,102,255,0.15)", borderRadius: 9, display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(77,144,255,0.4)", flexShrink: 0 }} />
      <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(77,144,255,0.6)" }}>Connect wallet</p>
    </div>
  );

  if (address) return (
    <button onClick={() => setAddress(null)} style={{ width: "100%", padding: "10px 12px", background: "rgba(0,214,143,0.08)", border: "1px solid rgba(0,214,143,0.2)", borderRadius: 9, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#00d68f", flexShrink: 0, boxShadow: "0 0 6px #00d68f" }} />
      <div style={{ flex: 1, textAlign: "left" }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#00d68f", lineHeight: 1 }}>{shortAddr(address)}</p>
        <p style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>Arc Testnet · Connected</p>
      </div>
    </button>
  );

  return (
    <button onClick={connect} disabled={loading} style={{ width: "100%", padding: "10px 12px", background: "rgba(0,102,255,0.08)", border: "1px solid rgba(0,102,255,0.2)", borderRadius: 9, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, opacity: loading ? 0.6 : 1 }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--arc-light)", flexShrink: 0 }} />
      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--arc-light)", lineHeight: 1 }}>{loading ? "Connecting..." : "Connect MetaMask"}</p>
    </button>
  );
}

export function useWalletAddress(): string {
  const [address, setAddress] = useState("");
  useEffect(() => {
    const eth = (window as any).ethereum;
    if (eth?.selectedAddress) setAddress(eth.selectedAddress);
    const handler = (accounts: string[]) => setAddress(accounts[0] || "");
    eth?.on("accountsChanged", handler);
    return () => eth?.removeListener("accountsChanged", handler);
  }, []);
  return address;
}
