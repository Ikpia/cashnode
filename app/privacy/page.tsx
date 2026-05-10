import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function PrivacyPage() {
  return (
    <AppShell mainClassName="py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <section className="page-card p-8">
          <h1 className="font-display text-headline-lg text-on-surface">Privacy</h1>
          <p className="mt-3 text-body-lg text-on-surface-variant">
            CashNode stores only the information needed to create, route, settle, and support payout requests.
          </p>
        </section>

        <section className="page-card p-8">
          <h2 className="font-display text-headline-md text-on-surface">What we collect and why</h2>
          <ul className="mt-4 space-y-3 text-body-md text-on-surface-variant">
            <li>Phone numbers are used for sign-in, request matching, pickup updates, and account support.</li>
            <li>Pickup locations and device location data are used to route requests to nearby eligible agents when live dispatch is enabled.</li>
            <li>Settlement account details are used only for agent reimbursement and payout settlement flows.</li>
            <li>Operational event data is retained to trace request lifecycles, investigate disputes, and support active payouts.</li>
          </ul>
        </section>

        <section className="page-card p-8">
          <h2 className="font-display text-headline-md text-on-surface">Service providers and sharing</h2>
          <ul className="mt-4 space-y-3 text-body-md text-on-surface-variant">
            <li>We share the minimum required payout and settlement data with providers that support authentication, messaging, maps, crypto payout execution, and bank settlement.</li>
            <li>Assigned agents see only the request details needed to complete the handoff, such as pickup point, receiver contact route, and payout amount.</li>
            <li>We do not present this page as a promise that data is never shared; operational sharing is part of how the payout flow works.</li>
          </ul>
        </section>

        <section className="page-card p-8">
          <h2 className="font-display text-headline-md text-on-surface">Retention and your choices</h2>
          <ul className="mt-4 space-y-3 text-body-md text-on-surface-variant">
            <li>CashNode keeps payout, settlement, and support records for as long as they are needed for operations, dispute handling, fraud prevention, and applicable legal obligations.</li>
            <li>You can ask for account detail corrections or request deletion review through support, subject to records we must retain for operational or legal reasons.</li>
            <li>Session state, device data, and similar browser storage may be used to keep you signed in and preserve in-progress flows.</li>
          </ul>
        </section>

        <section className="page-card p-8">
          <h2 className="font-display text-headline-md text-on-surface">Privacy questions</h2>
          <p className="mt-3 text-body-md text-on-surface-variant">
            If you need help with access, correction, deletion review, or a privacy concern, contact CashNode through the support workspace.
          </p>
          <Link href="/support" className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-md">
            Open support
          </Link>
        </section>
      </div>
    </AppShell>
  );
}