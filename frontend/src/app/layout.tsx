import type { Metadata } from "next";
import "./globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import { Providers } from "./providers";
import { WalletProvidersWrapper } from "@/components/WalletProvidersWrapper";

export const metadata: Metadata = {
  title: "Arc Invoice Desk",
  description: "Institutional invoice discounting powered by Arc Network and Circle StableFX.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <Providers>
          <WalletProvidersWrapper>
            {children}
          </WalletProvidersWrapper>
        </Providers>
      </body>
    </html>
  );
}
