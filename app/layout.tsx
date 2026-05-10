import type { Metadata } from "next";
import { AgentPresenceRuntimeProvider } from "@/components/agent-presence-runtime";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { WalletProvider } from "@/components/wallet-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"]
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700", "800"]
});

export const metadata: Metadata = {
  title: "CashNode",
  description: "Premium fintech interface for the CashNode payout network.",
  icons: {
    icon: "/cashnode-logo.svg",
    apple: "/cashnode-logo.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
      </head>
      <body className={`${inter.variable} ${plusJakarta.variable} bg-background font-sans text-on-surface`}>
        <WalletProvider>
          <AgentPresenceRuntimeProvider>{children}</AgentPresenceRuntimeProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
