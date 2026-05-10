import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/ui/icon";
import { requireSignedInUser } from "@/lib/auth-session";
import {
  listAssignedAgentPayoutRequests,
  listReceiverPayoutRequests,
  listSenderPayoutRequests
} from "@/lib/payout-requests";
import { getWelcomeGreeting } from "@/lib/user-greeting";

function formatStatusLabel(status: string) {
  switch (status) {
    case "accepted":
      return "Pickup ready";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Awaiting agent";
  }
}

function formatUsdt(value: number) {
  return `${value.toFixed(2)} USDT`;
}

function formatNgn(value: number) {
  return `NGN ${value.toLocaleString("en-NG")}`;
}

export default async function UnifiedDashboardPage() {
  const user = await requireSignedInUser();
  const [sentRequests, receivedRequests, agentRequests] = await Promise.all([
    listSenderPayoutRequests(user.id),
    listReceiverPayoutRequests(user.phoneNumber),
    user.agentProfile ? listAssignedAgentPayoutRequests(user.id) : Promise.resolve([])
  ]);
  const welcomeGreeting = getWelcomeGreeting(user, "Welcome back.");
  const mergedActivity = [...sentRequests, ...receivedRequests, ...agentRequests]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .filter((request, index, requests) => requests.findIndex((candidate) => candidate.id === request.id) === index);
  const latestActivity = mergedActivity.slice(0, 6);
  const latestSenderRequest = sentRequests[0] ?? null;
  const latestReceiverRequest = receivedRequests[0] ?? null;
  const activeSenderRequest =
    latestSenderRequest && (latestSenderRequest.status === "open" || latestSenderRequest.status === "accepted")
      ? latestSenderRequest
      : null;
  const activeReceiverRequest =
    latestReceiverRequest && (latestReceiverRequest.status === "open" || latestReceiverRequest.status === "accepted")
      ? latestReceiverRequest
      : null;
  const activeAgentRequest = agentRequests.find((request) => request.status === "accepted") ?? null;

  const primaryAction = activeSenderRequest
    ? {
        title: "Continue sender flow",
        copy: `Receiver ${activeSenderRequest.receiverName} is still in progress. Keep the payout moving from one request view.`,
        href: `/request-detail?id=${activeSenderRequest.id}`,
        cta: "Open current payout",
        amount: formatUsdt(activeSenderRequest.totalToken),
        subAmount: formatNgn(activeSenderRequest.estimatedLocalAmount)
      }
    : activeReceiverRequest
      ? {
          title: "Show pickup details",
          copy: `Your receiver workspace already has a live payout at ${activeReceiverRequest.pickupArea}.`,
          href: "/receiver-portal",
          cta: "Open receiver portal",
          amount: formatNgn(activeReceiverRequest.estimatedLocalAmount),
          subAmount: formatUsdt(activeReceiverRequest.totalToken)
        }
      : activeAgentRequest
        ? {
            title: "Manage active handoff",
            copy: `You have an accepted payout that still needs the cash handoff and settlement follow-through.`,
            href: "/agent-dashboard",
            cta: "Open agent workspace",
            amount: formatUsdt(activeAgentRequest.agentFeeToken),
            subAmount: formatNgn(activeAgentRequest.estimatedLocalAmount)
          }
        : user.agentProfile
          ? {
              title: "Launch the next payout",
              copy: "No live request needs attention right now. Start a new sender flow or check agent availability.",
              href: "/sender-dashboard",
              cta: "Start sender workspace",
              amount: `${sentRequests.length} sent`,
              subAmount: `${agentRequests.length} agent requests`
            }
          : {
              title: "Finish your most valuable setup",
              copy: "Your fastest expansion path is enabling agent mode with a verified payout bank and pickup hub.",
              href: "/onboarding/agent",
              cta: "Set up agent mode",
              amount: `${sentRequests.length} sent`,
              subAmount: `${receivedRequests.length} received`
            };

  return (
    <AppShell activeNav="home" mobileActive="home" mainClassName="pt-8">
      <section className="page-card mb-8 p-8">
        <p className="mb-2 text-sm font-semibold text-primary">{welcomeGreeting}</p>
        <h1 className="font-display text-headline-lg text-on-surface">Unified Dashboard</h1>
        <p className="mt-2 text-body-md text-on-surface-variant">
          Choose the workspace that matches what you need to do now: send a payout, track a pickup, or operate as an agent.
        </p>
      </section>

      <section className="mb-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="page-card p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-primary">Command center</p>
              <h2 className="mt-2 font-display text-headline-lg text-on-surface">{primaryAction.title}</h2>
              <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">{primaryAction.copy}</p>
            </div>
            <div className="rounded-2xl bg-surface-container-low px-4 py-3 text-right">
              <div className="text-xs uppercase tracking-[0.16em] text-on-surface-variant">Live focus</div>
              <div className="mt-1 font-semibold text-on-surface">{primaryAction.amount}</div>
              <div className="text-sm text-on-surface-variant">{primaryAction.subAmount}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href={primaryAction.href} className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-md">
              {primaryAction.cta}
            </Link>
            <Link href="/sender-dashboard" className="rounded-xl border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-on-surface">
              New sender request
            </Link>
            <Link href={user.agentProfile ? "/agent-dashboard" : "/onboarding/agent"} className="rounded-xl border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-on-surface">
              {user.agentProfile ? "Agent workspace" : "Enable agent mode"}
            </Link>
          </div>
        </div>

        <div className="page-card p-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-display text-headline-md text-on-surface">Live workspace snapshot</h2>
            <span className="status-live inline-flex">Now</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-surface-container-low p-4">
              <div className="text-caption text-on-surface-variant">Sender in flight</div>
              <div className="mt-2 text-[1.75rem] font-bold text-on-surface">{sentRequests.filter((request) => request.status !== "completed" && request.status !== "cancelled").length}</div>
            </div>
            <div className="rounded-2xl bg-surface-container-low p-4">
              <div className="text-caption text-on-surface-variant">Receivers waiting</div>
              <div className="mt-2 text-[1.75rem] font-bold text-on-surface">{receivedRequests.filter((request) => request.status === "open" || request.status === "accepted").length}</div>
            </div>
            <div className="rounded-2xl bg-surface-container-low p-4">
              <div className="text-caption text-on-surface-variant">Agent pickups</div>
              <div className="mt-2 text-[1.75rem] font-bold text-on-surface">{agentRequests.filter((request) => request.status === "accepted").length}</div>
            </div>
            <div className="rounded-2xl bg-surface-container-low p-4">
              <div className="text-caption text-on-surface-variant">Completed requests</div>
              <div className="mt-2 text-[1.75rem] font-bold text-on-surface">{mergedActivity.filter((request) => request.status === "completed").length}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8 grid gap-6 md:grid-cols-3">
        <Link href="/sender-dashboard" className="page-card rounded-[1.75rem] p-6 transition-transform hover:-translate-y-0.5">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon name="send_money" className="text-[26px]" />
          </div>
          <h2 className="font-display text-headline-md text-on-surface">Send Funds</h2>
          <p className="mt-2 text-sm text-on-surface-variant">Create a request, see what you pay in USDT, and track the receiver's cash pickup.</p>
          <p className="mt-4 text-sm font-semibold text-primary">{sentRequests.length} sent requests</p>
        </Link>

        <Link href="/receiver-portal" className="page-card rounded-[1.75rem] p-6 transition-transform hover:-translate-y-0.5">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary-container/40 text-secondary">
            <Icon name="payments" className="text-[26px]" />
          </div>
          <h2 className="font-display text-headline-md text-on-surface">Receive Cash</h2>
          <p className="mt-2 text-sm text-on-surface-variant">Check your cash amount, assigned agent, and pickup instructions in one place.</p>
          <p className="mt-4 text-sm font-semibold text-secondary">{receivedRequests.length} receiver payouts</p>
        </Link>

        <Link
          href={user.agentProfile ? "/agent-dashboard" : "/onboarding/agent"}
          className="page-card rounded-[1.75rem] p-6 transition-transform hover:-translate-y-0.5"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-tertiary-container/25 text-tertiary">
            <Icon name="storefront" className="text-[26px]" />
          </div>
          <h2 className="font-display text-headline-md text-on-surface">
            {user.agentProfile ? "Agent Workspace" : "Register as POS Agent"}
          </h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            {user.agentProfile
              ? "Go live, accept nearby payouts, manage pickups, and withdraw completed cash reimbursements."
              : "Complete onboarding, add your payout bank, and start earning agent fees."}
          </p>
          <p className="mt-4 text-sm font-semibold text-tertiary">
            {user.agentProfile ? `${agentRequests.length} assigned payouts` : "Activation pending"}
          </p>
        </Link>
      </section>

      <section className="page-card overflow-hidden">
        <div className="border-b border-stone-100 px-6 py-5">
          <h3 className="font-display text-headline-md text-on-surface">Recent Activity</h3>
        </div>

        {latestActivity.length === 0 ? (
          <div className="space-y-4 px-6 py-8 text-sm text-on-surface-variant">
            <div>No activity yet. Start by creating your first payout request or finish the workspace you plan to use most often.</div>
            <div className="flex flex-wrap gap-3">
              <Link href="/sender-dashboard" className="rounded-xl bg-primary px-4 py-2 font-semibold text-white shadow-md">
                Start a payout
              </Link>
              <Link href={user.agentProfile ? "/agent-dashboard" : "/onboarding/agent"} className="rounded-xl border border-stone-200 bg-white px-4 py-2 font-semibold text-on-surface">
                {user.agentProfile ? "Open agent workspace" : "Set up agent mode"}
              </Link>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {latestActivity.map((request) => (
              <Link
                key={request.id}
                href={`/request-detail?id=${request.id}`}
                className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-surface-container-low"
              >
                <div>
                  <p className="font-semibold text-on-surface">{request.reference}</p>
                  <p className="text-sm text-on-surface-variant">
                    {request.receiverName} · {request.pickupArea}
                  </p>
                </div>
                <span className="text-sm font-semibold text-primary uppercase">{formatStatusLabel(request.status)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
