import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/ui/icon";
import { images } from "@/lib/cashnode-data";

const flowCards = [
  {
    icon: "send_money",
    title: "1. Sender Creates",
    copy: "The sender initiates a transfer via the CashNode app, locking liquidity into a smart escrow node.",
    link: "Start a transfer",
    tone: "text-primary",
    bg: "bg-primary/10"
  },
  {
    icon: "verified_user",
    title: "2. Agent Accepts",
    copy: "A local agent near the receiver accepts the task and verifies their available cash liquidity.",
    link: "View agent network",
    tone: "text-secondary",
    bg: "bg-secondary-container/20"
  },
  {
    icon: "payments",
    title: "3. Receiver Collects",
    copy: "The receiver visits the agent, provides a secure OTP, and collects physical cash instantly.",
    link: "Find locations",
    tone: "text-tertiary",
    bg: "bg-tertiary-container/10"
  }
];

const valueProps = [
  {
    icon: "security",
    title: "Immutable Security",
    copy: "Every transaction is recorded on-chain, ensuring cryptographic proof of settlement for both parties."
  },
  {
    icon: "bolt",
    title: "Instant Settlement",
    copy: "Global transfers that settle as fast as you can walk to your nearest CashNode agent."
  },
  {
    icon: "savings",
    title: "Ultralow Fees",
    copy: "By cutting out correspondent banking layers, we pass 80% of traditional costs back to you."
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

export default function LandingPage() {
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
                Turning neighborhood agents into <span className="italic text-[#6ef0bf]">programmable</span> cash-out nodes.
              </h1>
            </div>

            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row md:mt-10">
              <Link
                href="/onboarding/sender"
                className="rounded-xl bg-white px-8 py-4 text-center text-sm font-semibold text-[#083724] shadow-md transition-transform hover:-translate-y-0.5"
              >
                Start Sender Onboarding
              </Link>
              <Link
                href="/onboarding/agent"
                className="rounded-xl border border-white/16 bg-white/10 px-8 py-4 text-center text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/16"
              >
                Become an Agent
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <p className="mb-4 text-sm text-stone-500">The Flow of Liquidity</p>
          <h2 className="mb-4 font-display text-headline-lg text-on-surface">Moving value across borders should not take days.</h2>
          <p className="text-body-md text-on-surface-variant">
            With CashNode, it is a three-step journey from digital asset to physical currency.
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
                Infrastructure that feels calm, local, and immediate.
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
              <h3 className="font-display text-headline-md text-on-surface">Live Node Stats</h3>
              <span className="status-live">Real-time</span>
            </div>

            <div className="grid grid-cols-2 gap-8">
              {liveStats.map((item) => (
                <div key={item.label}>
                  <p className="mb-1 text-caption uppercase tracking-[0.14em] text-on-surface-variant">{item.label}</p>
                  <p className="font-display text-[1.75rem] font-bold text-on-surface">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-2xl bg-surface-container-low p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold">Lagos Terminal 04</span>
                <span className="text-sm font-semibold text-primary">+$1,200</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-stone-200">
                <div className="h-full w-[75%] rounded-full bg-primary" />
              </div>
              <p className="mt-3 text-caption text-on-surface-variant">Node Capacity: 75% utilized</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <div className="relative">
            <div className="overflow-hidden rounded-[2.5rem] border-[10px] border-white shadow-ambient">
              <img src={images.nodeMap} alt="CashNode local liquidity map" className="h-[500px] w-full object-cover" />
            </div>

            <div className="page-card absolute left-6 top-6 flex items-center gap-4 rounded-2xl px-4 py-3">
              <div className="h-12 w-12 overflow-hidden rounded-full bg-primary">
                <img src={images.floatingAgent} alt="Sarah Grocery agent profile" className="h-full w-full object-cover" />
              </div>
              <div>
                <p className="text-sm font-semibold">Sarah&apos;s Grocery</p>
                <p className="text-caption text-primary">Online - 200m away</p>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <p className="mb-3 text-sm text-stone-500">Universal Liquidity Map</p>
              <h2 className="mb-5 font-display text-headline-lg text-on-surface">The physical infrastructure layer for the new internet of value.</h2>
              <p className="max-w-xl text-body-lg text-on-surface-variant">
                CashNode turns existing trusted merchants into mini-banks, making cash access as ubiquitous as a corner store.
              </p>
            </div>

            <ul className="space-y-4">
              {[
                "Geofenced security perimeters for agents",
                "Dynamic liquidity rebalancing",
                "Automated KYB verification for nodes"
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-body-md text-on-surface">
                  <Icon name="check_circle" filled className="text-primary" />
                  {item}
                </li>
              ))}
            </ul>

            <Link
              href="/agent-dashboard"
              className="inline-flex rounded-xl border-2 border-primary px-8 py-4 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
            >
              Explore Local Nodes
            </Link>
          </div>
        </div>
      </section>

      <section className="subtle-grid relative overflow-hidden rounded-[2rem] bg-primary px-6 py-16 text-center text-white md:px-12 md:py-20">
        <div className="mx-auto max-w-3xl space-y-8">
          <h2 className="font-display text-[2.2rem] font-bold leading-tight md:text-[2.95rem]">Ready to join the node network?</h2>
          <p className="mx-auto max-w-2xl text-body-lg text-white/85">
            Whether you are sending value home or looking to monetize your business&apos;s idle cash, CashNode is your bridge to the global economy.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/onboarding/sender"
              className="rounded-2xl bg-white px-10 py-4 text-sm font-semibold text-primary shadow-md transition-transform hover:-translate-y-0.5"
            >
              Start Sender Onboarding
            </Link>
            <Link
              href="/onboarding/agent"
              className="rounded-2xl border border-white/25 bg-primary-container px-10 py-4 text-sm font-semibold text-white transition-colors hover:bg-[#0a9b6e]"
            >
              Register as Agent
            </Link>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
