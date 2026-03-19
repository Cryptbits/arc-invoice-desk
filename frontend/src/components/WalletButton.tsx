"use client";
import { useState, useEffect } from "react";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
      selectedAddress: string | null;
    };
  }
}

function shortAddr(addr: string) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export function WalletButton() {
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (window.ethereum?.selectedAddress) {
      setAddress(window.ethereum.selectedAddress);
    }
    const handler = (accounts: unknown) => {
      const list = accounts as string[];
      setAddress(list[0] || null);
    };
    window.ethereum?.on("accountsChanged", handler);
    return () => window.ethereum?.removeListener("accountsChanged", handler);
  }, []);

  async function connect() {
    if (!window.ethereum) {
      alert("MetaMask not found. Please install MetaMask from metamask.io then refresh.");
      return;
    }
    setLoading(true);
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
      setAddress(accounts[0]);
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0x4CE452",
            chainName: "Arc Testnet",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://rpc.testnet.arc.network"],
            blockExplorerUrls: ["https://testnet.arcscan.app"],
          }],
        });
      } catch {
        // Chain already added
      }
    } catch {
      // User rejected
    } finally {
      setLoading(false);
    }
  }

  function disconnect() {
    setAddress(null);
  }

  if (!mounted) {
    return (
      <div style={{ width: "100%", padding: "10px 12px", background: "rgba(0,102,255,0.06)", border: "1px solid rgba(0,102,255,0.15)", borderRadius: 9, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(77,144,255,0.4)", flexShrink: 0 }} />
        <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(77,144,255,0.6)" }}>Connect wallet</p>
      </div>
    );
  }

  if (address) {
    return (
      <button
        onClick={disconnect}
        style={{ width: "100%", padding: "10px 12px", background: "rgba(0,214,143,0.08)", border: "1px solid rgba(0,214,143,0.2)", borderRadius: 9, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "opacity 0.14s" }}
        onMouseEnter={e => (e.currentTarget.style.opacity = "0.8")}
        onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
      >
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#00d68f", flexShrink: 0, boxShadow: "0 0 6px #00d68f" }} />
        <div style={{ flex: 1, textAlign: "left" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#00d68f", lineHeight: 1 }}>{shortAddr(address)}</p>
          <p style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>Arc Testnet · Connected</p>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={loading}
      style={{ width: "100%", padding: "10px 12px", background: "rgba(0,102,255,0.08)", border: "1px solid rgba(0,102,255,0.2)", borderRadius: 9, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, transition: "all 0.14s", opacity: loading ? 0.6 : 1 }}
      onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "rgba(0,102,255,0.14)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,102,255,0.08)"; }}
    >
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--arc-light)", flexShrink: 0 }} />
      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--arc-light)", lineHeight: 1 }}>
        {loading ? "Connecting..." : "Connect MetaMask"}
      </p>
    </button>
  );
}

export function useWalletAddress(): string {
  const [address, setAddress] = useState("");
  useEffect(() => {
    if (window.ethereum?.selectedAddress) setAddress(window.ethereum.selectedAddress);
    const handler = (accounts: unknown) => {
      const list = accounts as string[];
      setAddress(list[0] || "");
    };
    window.ethereum?.on("accountsChanged", handler);
    return () => window.ethereum?.removeListener("accountsChanged", handler);
  }, []);
  return address;
}
