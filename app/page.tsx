import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/ui/icon";
import { images } from "@/lib/cashnode-data";

const flowCards = [
  {
    icon: "send_money",
    title: "1. Sender Creates",
    copy: "The sender creates a payout request, sees the exact USDT cost, and chooses where the receiver will collect cash.",
    link: "Create a payout",
    tone: "text-primary",
    bg: "bg-primary/10"
  },
  {
    icon: "verified_user",
    title: "2. Agent Accepts",
    copy: "A nearby CashNode agent accepts the request, prepares the handoff, and confirms the pickup point.",
    link: "See agent flow",
    tone: "text-secondary",
    bg: "bg-secondary-container/20"
  },
  {
    icon: "payments",
    title: "3. Receiver Collects",
    copy: "The receiver shows the pickup code, confirms the amount, and collects NGN cash from the assigned agent.",
    link: "Track a pickup",
    tone: "text-tertiary",
    bg: "bg-tertiary-container/10"
  }
];

const valueProps = [
  {
    icon: "security",
    title: "Clear, Verified Handoffs",
    copy: "Every payout keeps one reference, one pickup code, and one visible agent trail so users always know what happens next."
  },
  {
    icon: "bolt",
    title: "Fast Local Pickup",
    copy: "Receivers collect from nearby agents instead of waiting for slow bank-to-bank international rails."
  },
  {
    icon: "savings",
    title: "Transparent Pricing",
    copy: "The sender sees the total USDT cost up front, and the receiver sees the exact NGN cash amount for pickup."
  }
];

const comparisonRows = [
  {
    before: "Receiver needs crypto knowledge or a bank-dependent payout route.",
    after: "Receiver only needs a pickup point, a cash amount in NGN, and a code."
  },
  {
    before: "Senders mentally calculate fees and handoff risk across separate tools.",
    after: "CashNode shows total sender cost, receiver cash, and agent handoff in one visible flow."
  },
  {
    before: "Agent reimbursement failures look like broken operations.",
    after: "Settlement status stays visible even when manual payout handling is required."
  }
];

const liveStats = [
  { label: "Total Liquidity", value: "$14.2M" },
  { label: "Active Nodes", value: "12,482" },
  { label: "Avg. Time", value: "14m" },
  { label: "Reliability", value: "99.9%" }
];

const globeRoutes = [
  { d: "M500 264 Q392 196 218 282", dur: "3.1s", begins: ["0s", "-0.9s", "-1.8s"] },
  { d: "M500 264 Q430 206 332 218", dur: "2.8s", begins: ["-0.3s", "-1.2s", "-2s"] },
  { d: "M500 264 Q426 348 312 468", dur: "3.4s", begins: ["-0.6s", "-1.7s", "-2.6s"] },
  { d: "M500 264 Q482 340 430 430", dur: "2.9s", begins: ["-0.2s", "-1.3s", "-2.1s"] },
  { d: "M500 264 Q562 292 640 310", dur: "2.7s", begins: ["-0.4s", "-1.1s", "-1.9s"] },
  { d: "M500 264 Q616 220 780 248", dur: "3.2s", begins: ["-0.8s", "-1.8s", "-2.7s"] },
  { d: "M500 264 Q600 330 842 430", dur: "3.6s", begins: ["-0.5s", "-1.6s", "-2.8s"] },
  { d: "M500 264 Q564 392 706 476", dur: "3.3s", begins: ["-1s", "-2s", "-2.9s"] }
];

const globeNodes = [
  { cx: 218, cy: 282, delay: "0s" },
  { cx: 332, cy: 218, delay: "0.6s" },
  { cx: 312, cy: 468, delay: "1s" },
  { cx: 430, cy: 430, delay: "1.8s" },
  { cx: 500, cy: 264, delay: "0.4s" },
  { cx: 640, cy: 310, delay: "1.6s" },
  { cx: 780, cy: 248, delay: "0.8s" },
  { cx: 842, cy: 430, delay: "2s" },
  { cx: 706, cy: 476, delay: "1.2s" }
];

function GlobeNetworkOverlay() {
  return (
    <svg
      viewBox="0 0 1000 620"
      className="pointer-events-none absolute inset-0 z-20 h-full w-full"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="cashnode-glow">
          <feGaussianBlur stdDeviation="5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {globeRoutes.map((route) => (
        <path
          key={route.d}
          d={route.d}
          fill="none"
          stroke="rgba(104, 219, 169, 0.5)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}

      {globeNodes.map((node) => (
        <g key={`${node.cx}-${node.cy}`} filter="url(#cashnode-glow)">
          <circle cx={node.cx} cy={node.cy} r="5" fill="#9bf8d0" opacity="0.95" />
          <circle cx={node.cx} cy={node.cy} r="10" fill="#68dba9" opacity="0.24">
            <animate attributeName="r" values="7;15;7" dur="2.8s" begin={node.delay} repeatCount="indefinite" />
            <animate
              attributeName="opacity"
              values="0.55;0.08;0.55"
              dur="2.8s"
              begin={node.delay}
              repeatCount="indefinite"
            />
          </circle>
        </g>
      ))}

      {globeRoutes.map((route) =>
        route.begins.map((begin, particleIndex) => (
          <g key={`${route.d}-motion-${begin}`} filter="url(#cashnode-glow)">
            <circle
              r={particleIndex === 0 ? 10 : particleIndex === 1 ? 8 : 6}
              fill="#68dba9"
              opacity={particleIndex === 0 ? "0.2" : particleIndex === 1 ? "0.16" : "0.12"}
            >
              <animateMotion dur={route.dur} begin={begin} repeatCount="indefinite" path={route.d} />
              <animate
                attributeName="opacity"
                values={particleIndex === 0 ? "0.16;0.3;0.16" : particleIndex === 1 ? "0.12;0.24;0.12" : "0.1;0.18;0.1"}
                dur={route.dur}
                repeatCount="indefinite"
              />
            </circle>
            <circle
              r={particleIndex === 0 ? 4.6 : particleIndex === 1 ? 3.9 : 3.2}
              fill="#d2ffe8"
              opacity={particleIndex === 0 ? "1" : particleIndex === 1 ? "0.9" : "0.82"}
            >
              <animateMotion dur={route.dur} begin={begin} repeatCount="indefinite" path={route.d} />
              <animate
                attributeName="opacity"
                values={particleIndex === 0 ? "0.82;1;0.82" : particleIndex === 1 ? "0.68;0.92;0.68" : "0.58;0.84;0.58"}
                dur={route.dur}
                repeatCount="indefinite"
              />
            </circle>
          </g>
        ))
      )}
    </svg>
  );
}

export default async function LandingPage() {
  return (
    <AppShell activeNav="home" mobileActive="home" mainClassName="px-4 md:px-8">
      <section className="relative left-1/2 right-1/2 -mx-[50vw] w-screen overflow-hidden pt-6 pb-16 shadow-ambient md:pt-8 md:pb-24">
        <img
          src={images.networkMap}
          alt="CashNode world liquidity map"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,14,11,0.92)_0%,rgba(4,14,11,0.74)_44%,rgba(4,14,11,0.5)_72%,rgba(4,14,11,0.64)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(28,255,179,0.18),transparent_34%),radial-gradient(circle_at_78%_30%,rgba(28,255,179,0.16),transparent_28%),radial-gradient(circle_at_55%_80%,rgba(28,255,179,0.1),transparent_28%)]" />
        <GlobeNetworkOverlay />

        <div className="relative z-10 mx-auto flex min-h-[560px] max-w-shell flex-col items-center justify-center px-4 text-center md:min-h-[620px] md:px-8 lg:px-14">
          <div className="max-w-4xl">
            <div className="-translate-y-10 space-y-6 md:-translate-y-14 lg:-translate-y-16">
              <h1 className="mx-auto max-w-3xl font-display text-[2.6rem] font-bold leading-[0.96] tracking-[-0.03em] text-white md:text-[3.85rem]">
                Send USDT, assign a nearby agent, and let the receiver pick up <span className="italic text-[#6ef0bf]">cash locally</span>.
              </h1>
              <p className="mx-auto max-w-2xl text-base text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.55)] md:text-lg">
                CashNode helps senders fund payouts, agents manage nearby handoffs, and receivers collect NGN with a simple pickup code.
              </p>
            </div>

            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row md:mt-10">
              <Link
                href="/auth"
                className="rounded-xl bg-white px-8 py-4 text-center text-sm font-semibold text-[#083724] shadow-md transition-transform hover:-translate-y-0.5"
              >
                Create your account
              </Link>
              <Link
                href="#how-it-works"
                className="rounded-xl border border-white/20 bg-white/10 px-8 py-4 text-center text-sm font-semibold text-white backdrop-blur-md transition-transform hover:-translate-y-0.5"
              >
                See how it works
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-16 md:py-20">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <p className="mb-4 text-sm text-stone-500">The Flow of Liquidity</p>
          <h2 className="mb-4 font-display text-headline-lg text-on-surface">Moving value across borders should not take days.</h2>
          <p className="text-body-md text-on-surface-variant">
            CashNode keeps it simple: fund the request, match the agent, complete pickup.
          </p>
        </div>

        <div className="grid gap-gutter md:grid-cols-3">
          {flowCards.map((card) => (
            <div key={card.title} className="page-card flex min-h-[280px] flex-col justify-between rounded-[2rem] p-8 transition-transform hover:-translate-y-1">
              <div className="space-y-6">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${card.bg} ${card.tone}`}>
                  <Icon name={card.icon} className="text-[32px]" />
                </div>
                <h3 className="font-display text-headline-md text-on-surface">{card.title}</h3>
                <p className="text-body-md text-on-surface-variant">{card.copy}</p>
              </div>

              <span className={`inline-flex items-center gap-2 text-sm font-semibold ${card.tone}`}>
                {card.link}
                <Icon name="arrow_forward" className="text-[16px]" />
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[3rem] sand-panel px-6 py-16 md:px-16 md:py-20">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 opacity-20 lg:block">
          <img src={images.workspace} alt="CashNode premium workspace" className="h-full w-full object-cover" />
        </div>

        <div className="relative z-10 grid items-center gap-12 lg:grid-cols-2">
          <div className="space-y-10">
            <div>
              <p className="mb-3 text-sm text-stone-500">Built for trust, optimized for speed.</p>
              <h2 className="max-w-xl font-display text-[2.35rem] font-bold leading-tight text-on-surface md:text-[2.65rem]">
                Cash pickup should feel calm, local, and easy to follow.
              </h2>
            </div>

            <div className="space-y-8">
              {valueProps.map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-soft">
                    <Icon name={item.icon} filled className="text-primary" />
                  </div>
                  <div>
                    <h3 className="mb-2 font-display text-[1.15rem] font-semibold text-on-surface">{item.title}</h3>
                    <p className="text-body-md text-on-surface-variant">{item.copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="page-card glass-panel rounded-[2rem] p-8">
            <div className="mb-8 flex items-center justify-between border-b border-stone-100 pb-5">
              <h3 className="font-display text-headline-md text-on-surface">What users always understand</h3>
              <span className="status-live">4 moments</span>
            </div>

            <div className="space-y-4">
              {[
                "Sender funds a payout and sees the total USDT cost.",
                "A nearby agent accepts the request and confirms the pickup hub.",
                "The receiver sees NGN first and collects cash with one code.",
                "Agent reimbursement stays visible even if settlement is queued manually."
              ].map((item, index) => (
                <div key={item} className="flex gap-4 rounded-2xl bg-surface-container-low px-4 py-4">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <p className="text-sm text-on-surface-variant">{item}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/auth" className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-md">
                Start using CashNode
              </Link>
              <Link href="/support" className="rounded-xl border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-on-surface">
                See support options
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-12 md:pb-20">
        <div className="page-card rounded-[2.5rem] p-8 md:p-10">
          <div className="mb-8 max-w-2xl">
            <p className="mb-3 text-sm text-stone-500">Why users trust CashNode</p>
            <h2 className="font-display text-headline-lg text-on-surface">A cleaner story than informal remittance routing.</h2>
            <p className="mt-3 text-body-md text-on-surface-variant">
              CashNode reduces confusion for senders, receivers, and agents by keeping the payment story visible from start to finish.
            </p>
          </div>

          <div className="space-y-4">
            {comparisonRows.map((row) => (
              <div key={row.before} className="grid gap-4 rounded-[1.5rem] border border-stone-100 p-5 md:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-stone-400">Before</div>
                  <div className="mt-2 text-sm text-on-surface-variant">{row.before}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-primary">With CashNode</div>
                  <div className="mt-2 text-sm font-semibold text-on-surface">{row.after}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-18">
        <div className="relative overflow-hidden rounded-[2.75rem] shadow-ambient">
          <img
            src={images.nodeMap}
            alt="CashNode local liquidity map"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,15,11,0.9)_0%,rgba(5,15,11,0.76)_34%,rgba(5,15,11,0.38)_58%,rgba(5,15,11,0.8)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_24%,rgba(110,240,191,0.16),transparent_28%),radial-gradient(circle_at_82%_36%,rgba(110,240,191,0.2),transparent_26%)]" />

          <div className="relative z-10 flex min-h-[420px] items-end px-6 py-5 md:px-10 md:py-8 lg:min-h-[460px]">
            <div className="absolute left-6 top-5 rounded-[1.6rem] border border-white/15 bg-white/95 px-4 py-3 shadow-soft backdrop-blur-md md:left-10 md:top-8">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 overflow-hidden rounded-full bg-primary">
                  <img src={images.floatingAgent} alt="Sarah Grocery agent profile" className="h-full w-full object-cover" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-on-surface">Sarah&apos;s Grocery</p>
                  <p className="text-caption text-primary">Online - 200m away</p>
                </div>
              </div>
            </div>

            <div className="ml-auto w-full max-w-2xl rounded-[2rem] border border-white/12 bg-[rgba(7,21,16,0.52)] p-6 text-white shadow-[0_24px_60px_rgba(0,0,0,0.22)] backdrop-blur-md md:p-8">
              <div>
                <p className="mb-3 text-sm text-white/72">Universal Liquidity Map</p>
                <h2 className="mb-5 font-display text-headline-lg text-white">A trusted pickup network built on real local businesses.</h2>
                <p className="max-w-xl text-body-lg text-white/88">
                  CashNode works with neighborhood agents so receivers can collect cash at familiar locations instead of navigating complex remittance flows.
                </p>
              </div>

              <ul className="mt-6 space-y-3">
                {[
                  "Live location-aware agent matching",
                  "Clear pickup codes and request tracking",
                  "Verified settlement accounts for agent payouts"
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-body-md text-white">
                    <Icon name="check_circle" filled className="text-[#6ef0bf]" />
                    {item}
                  </li>
                ))}
              </ul>

              <Link
                href="/agent-dashboard"
                className="mt-6 inline-flex rounded-xl border-2 border-white/30 bg-white/10 px-8 py-4 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-white hover:text-[#083724]"
              >
                Explore Agent Workspace
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="subtle-grid relative overflow-hidden rounded-[2rem] bg-primary px-6 py-16 text-center text-white md:px-12 md:py-20">
        <div className="mx-auto max-w-3xl space-y-8">
          <h2 className="font-display text-[2.2rem] font-bold leading-tight md:text-[2.95rem]">Ready to send or receive with less friction?</h2>
          <p className="mx-auto max-w-2xl text-body-lg text-white/85">
            Whether you are funding a pickup for family or managing payouts as a local agent, CashNode keeps the steps visible and the handoff simple.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/auth"
              className="rounded-2xl bg-white px-10 py-4 text-sm font-semibold text-primary shadow-md transition-transform hover:-translate-y-0.5"
            >
              Create your account
            </Link>
            <Link
              href="/support"
              className="rounded-2xl border border-white/20 bg-white/10 px-10 py-4 text-sm font-semibold text-white backdrop-blur-md transition-transform hover:-translate-y-0.5"
            >
              Get support
            </Link>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
