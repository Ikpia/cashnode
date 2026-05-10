import Link from "next/link";
import { AppShell } from "@/components/app-shell";

const supportPhone = "+2348001110000";
const supportWhatsApp = "2348001110000";

export default function SupportPage() {
  return (
    <AppShell activeNav="home" mobileActive="home" mainClassName="py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <section className="page-card p-8">
          <h1 className="font-display text-headline-lg text-on-surface">Support</h1>
          <p className="mt-3 text-body-lg text-on-surface-variant">
            Reach CashNode support if a pickup is delayed, an agent needs help, or a payout needs manual review.
          </p>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <a href={`https://wa.me/${supportWhatsApp}`} target="_blank" rel="noreferrer" className="page-card p-8 transition-transform hover:-translate-y-0.5">
            <h2 className="font-display text-headline-md text-on-surface">WhatsApp Support</h2>
            <p className="mt-3 text-body-md text-on-surface-variant">Send request references and pickup issues directly to the support desk.</p>
          </a>

          <a href={`tel:${supportPhone}`} className="page-card p-8 transition-transform hover:-translate-y-0.5">
            <h2 className="font-display text-headline-md text-on-surface">Call Support</h2>
            <p className="mt-3 text-body-md text-on-surface-variant">Use this line for urgent payout or pickup coordination.</p>
          </a>
        </section>

        <section className="page-card p-8">
          <h2 className="font-display text-headline-md text-on-surface">Before you contact support</h2>
          <ul className="mt-4 space-y-3 text-body-md text-on-surface-variant">
            <li>Keep the request reference ready.</li>
            <li>Confirm the receiver phone number used on the request.</li>
            <li>Note the assigned agent name or pickup location if available.</li>
          </ul>
          <div className="mt-6">
            <Link href="/dashboard" className="inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-md">
              Back to workspace
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}