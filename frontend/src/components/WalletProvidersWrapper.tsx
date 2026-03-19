"use client";
import dynamic from "next/dynamic";

const WalletProviders = dynamic(
  () => import("./WalletProviders").then(m => ({ default: m.WalletProviders })),
  { ssr: false }
);

export function WalletProvidersWrapper({ children }: { children: React.ReactNode }) {
  return <WalletProviders>{children}</WalletProviders>;
}
