import { AppShell } from "@/components/app-shell";

export default function SecurityPage() {
  return (
    <AppShell activeNav="home" mobileActive="home" mainClassName="py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <section className="page-card p-8">
          <h1 className="font-display text-headline-lg text-on-surface">Security</h1>
          <p className="mt-3 text-body-lg text-on-surface-variant">
            CashNode uses verified sign-in sessions, unique pickup references, assigned-agent tracking, and verified settlement accounts to reduce payout risk.
          </p>
        </section>

        <section className="page-card p-8">
          <h2 className="font-display text-headline-md text-on-surface">How we reduce risk</h2>
          <ul className="mt-4 space-y-3 text-body-md text-on-surface-variant">
            <li>Every payout has a unique reference and pickup code.</li>
            <li>Agents can only act on requests routed to their active profile.</li>
            <li>Receiver pickup details remain tied to the verified phone session.</li>
            <li>Agent bank payouts use verified settlement account details.</li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}