import Link from "next/link";
import type { ReactNode } from "react";
import { AuthControls } from "@/components/auth-controls";
import { Icon } from "@/components/ui/icon";
import { WalletControls } from "@/components/wallet-controls";

type DesktopNavKey = "home" | "sender" | "agent" | "receiver" | "request" | "payout";
type MobileNavKey = "home" | "wallet" | "activity" | "profile";

type AppShellProps = {
  children: ReactNode;
  activeNav?: DesktopNavKey;
  mobileActive?: MobileNavKey;
  showAvatar?: boolean;
  showWalletControls?: boolean;
  showMobileLabels?: boolean;
  mainClassName?: string;
  mobileProfileHref?: string;
};

const desktopLinks = [
  { key: "home" as const, label: "Home", href: "/" },
  { key: "sender" as const, label: "Send", href: "/sender-dashboard" },
  { key: "receiver" as const, label: "Receive", href: "/receiver-portal" },
  { key: "agent" as const, label: "Agent", href: "/agent-dashboard" }
];

export function AppShell({
  children,
  activeNav,
  mobileActive,
  showAvatar = false,
  showWalletControls = false,
  showMobileLabels = false,
  mainClassName = "",
  mobileProfileHref = "/agent-dashboard"
}: AppShellProps) {
  const mobileLinks = [
    { key: "home" as const, label: "Home", icon: "home_app_logo", href: "/" },
    { key: "wallet" as const, label: "Pickup", icon: "payments", href: "/payout-confirmation" },
    { key: "activity" as const, label: "Activity", icon: "receipt_long", href: "/request-detail" },
    { key: "profile" as const, label: "Profile", icon: "person", href: mobileProfileHref }
  ];

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <header className="sticky top-0 z-50 hidden border-b border-stone-200 bg-[#faf9f6]/80 shadow-sm backdrop-blur-xl md:block">
        <div className="mx-auto flex w-full max-w-shell items-center justify-between px-8 py-4">
          <Link href="/" className="font-display text-[2rem] font-bold tracking-tight text-primary">
            CashNode
          </Link>

          <nav className="flex items-center gap-8">
            {desktopLinks.map((link) => {
              const active = link.key === activeNav;
              return (
                <Link
                  key={link.key}
                  href={link.href}
                  className={
                    active
                      ? "border-b-2 border-primary pb-1 font-semibold text-primary"
                      : "text-stone-500 transition-colors hover:text-stone-800"
                  }
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <AuthControls />
            {showWalletControls ? <WalletControls showAvatar={showAvatar} /> : null}
          </div>
        </div>
      </header>

      <main className={`mx-auto w-full max-w-shell px-4 pb-32 md:px-8 ${mainClassName}`.trim()}>{children}</main>

      <footer className="mt-24 hidden border-t border-stone-200 bg-[#faf9f6] md:block">
        <div className="mx-auto flex w-full max-w-shell flex-col items-center justify-between gap-6 px-8 py-12 text-sm text-stone-500 md:flex-row">
          <div className="flex flex-col gap-2 md:items-start">
            <div className="font-display text-lg font-bold text-stone-900">CashNode</div>
            <p>Cross-border cash pickup with clear pricing, trusted agents, and faster local access.</p>
          </div>

          <div className="flex flex-wrap justify-center gap-6">
            <Link href="/security">Security</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/support">Support</Link>
          </div>

          <div>(c) 2026 CashNode. All rights reserved.</div>
        </div>
      </footer>

      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around rounded-t-[28px] border-t border-stone-200 bg-white/90 px-6 pb-8 pt-4 shadow-[0_-4px_24px_rgba(0,0,0,0.04)] backdrop-blur-2xl md:hidden">
        {mobileLinks.map((link) => {
          const active = link.key === mobileActive;

          return (
            <Link
              key={link.key}
              href={link.href}
              className={`flex flex-col items-center justify-center gap-1 transition-transform ${
                active ? "scale-110 text-primary" : "text-stone-400"
              }`}
            >
              <Icon name={link.icon} filled={active} />
              {showMobileLabels ? <span className="text-[10px] font-medium">{link.label}</span> : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
