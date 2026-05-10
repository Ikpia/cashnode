import { AppShell } from "@/components/app-shell";

export default function TermsPage() {
  return (
    <AppShell activeNav="home" mobileActive="home" mainClassName="py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <section className="page-card p-8">
          <h1 className="font-display text-headline-lg text-on-surface">Terms</h1>
          <p className="mt-3 text-body-lg text-on-surface-variant">
            CashNode coordinates payout requests between senders, receivers, and approved POS agents. Final availability depends on agent acceptance, location, limits, and payout provider readiness.
          </p>
        </section>

        <section className="page-card p-8">
          <h2 className="font-display text-headline-md text-on-surface">Important usage rules</h2>
          <ul className="mt-4 space-y-3 text-body-md text-on-surface-variant">
            <li>Pickup codes should only be shared at the handoff location.</li>
            <li>Requests may be cancelled only before an agent has completed the cash handoff.</li>
            <li>Agent payouts may be queued when provider-side bank disbursement is unavailable.</li>
            <li>Users are responsible for entering correct receiver and payout details.</li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}