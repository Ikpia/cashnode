import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ChoiceChip, FeatureBullet, OnboardingHero } from "@/components/onboarding-kit";
import { Icon } from "@/components/ui/icon";

const roleCards = [
  {
    title: "Sender",
    href: "/onboarding/sender",
    icon: "send_money",
    badge: "Fast",
    badgeClass: "status-success",
    description: "Sign up, verify, fund.",
    steps: ["Account", "OTP", "Fund"]
  },
  {
    title: "POS agent",
    href: "/onboarding/agent",
    icon: "storefront",
    badge: "Strict",
    badgeClass: "status-live",
    description: "Business, proof, stake.",
    steps: ["Business", "KYC", "Activate"]
  },
  {
    title: "Receiver",
    href: "/onboarding/receiver",
    icon: "payments",
    badge: "Light",
    badgeClass: "status-pending",
    description: "Alert, code, pickup.",
    steps: ["Alert", "Code", "Collect"]
  }
];

export default function OnboardingIndexPage() {
  return (
    <AppShell activeNav="home" mobileActive="home" mainClassName="py-8">
      <div className="space-y-10">
        <OnboardingHero
          eyebrow="Onboarding System"
          backHref="/"
          backLabel="Back to landing page"
          title="Short onboarding flows for every CashNode role."
          description="Fast for senders. Strict for agents. Minimal for receivers."
        />

        <div className="flex flex-wrap gap-3">
          <ChoiceChip label="Fast setup" active />
          <ChoiceChip label="Role-based security" />
          <ChoiceChip label="Reusable flow" />
        </div>

        <section className="grid gap-6 lg:grid-cols-3">
          {roleCards.map((card) => (
            <div key={card.title} className="page-card flex flex-col rounded-[2rem] p-8">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon name={card.icon} className="text-[28px]" />
                </div>
                <span className={`${card.badgeClass} inline-flex`}>{card.badge}</span>
              </div>

              <div className="space-y-3">
                <h2 className="font-display text-headline-md text-on-surface">{card.title}</h2>
                <p className="text-sm text-on-surface-variant">{card.description}</p>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {card.steps.map((step) => (
                  <span key={step} className="rounded-full bg-surface-container-low px-3 py-2 text-sm font-semibold text-on-surface">
                    {step}
                  </span>
                ))}
              </div>

              <Link
                href={card.href}
                className="primary-gradient mt-8 inline-flex items-center justify-center gap-2 rounded-xl px-6 py-4 text-sm font-semibold text-white shadow-md transition-transform hover:-translate-y-0.5"
              >
                Open flow
                <Icon name="arrow_forward" className="text-[18px]" />
              </Link>
            </div>
          ))}
        </section>

        <section className="grid gap-6 rounded-[2rem] sand-panel p-8 lg:grid-cols-3">
          <FeatureBullet icon="speed" title="Quick for senders" copy="Create an account and reach the first payout fast." />
          <FeatureBullet icon="shield" title="Secure for agents" copy="Identity, location, and funding checks before activation." />
          <FeatureBullet icon="bolt" title="Light for receivers" copy="Most pickups should work from a verified alert and code." />
        </section>
      </div>
    </AppShell>
  );
}
