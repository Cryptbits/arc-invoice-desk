import type { Metadata } from "next";
import "./globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import { Providers } from "./providers";
import { WalletProvidersWrapper } from "@/components/WalletProvidersWrapper";

export const metadata: Metadata = {
  title: "Arc Invoice Desk",
  description: "Institutional invoice discounting powered by Arc Network and Circle StableFX.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://arc-invoice-desk.vercel.app"),
  openGraph: {
    title: "Arc Invoice Desk",
    description: "Invoice discounting at settlement speed. Powered by Arc Network and Circle StableFX.",
    type: "website",
    images: [{ url: "/og.svg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Arc Invoice Desk",
    description: "Invoice discounting at Arc speed.",
    images: ["/og.svg"],
  },
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
