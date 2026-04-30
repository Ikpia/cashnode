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

  return (
    <AppShell activeNav="home" mobileActive="home" mainClassName="pt-8">
      <section className="page-card mb-8 p-8">
        <p className="mb-2 text-sm font-semibold text-primary">{welcomeGreeting}</p>
        <h1 className="font-display text-headline-lg text-on-surface">Unified Dashboard</h1>
        <p className="mt-2 text-body-md text-on-surface-variant">
          Send and receive from one account, then activate POS agent mode when you are ready.
        </p>
      </section>

      <section className="mb-8 grid gap-6 md:grid-cols-3">
        <Link href="/sender-dashboard" className="page-card rounded-[1.75rem] p-6 transition-transform hover:-translate-y-0.5">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon name="send_money" className="text-[26px]" />
          </div>
          <h2 className="font-display text-headline-md text-on-surface">Send Funds</h2>
          <p className="mt-2 text-sm text-on-surface-variant">Create payout requests and track dispatch to nearby POS agents.</p>
          <p className="mt-4 text-sm font-semibold text-primary">{sentRequests.length} sent requests</p>
        </Link>

        <Link href="/receiver-portal" className="page-card rounded-[1.75rem] p-6 transition-transform hover:-translate-y-0.5">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary-container/40 text-secondary">
            <Icon name="payments" className="text-[26px]" />
          </div>
          <h2 className="font-display text-headline-md text-on-surface">Receive Cash</h2>
          <p className="mt-2 text-sm text-on-surface-variant">View pickup code, assigned agent, and live payout status.</p>
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
              ? "Go live, accept nearby payouts, and complete cash handoffs."
              : "Complete onboarding, connect stake wallet, and start earning agent fees."}
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
          <div className="px-6 py-8 text-sm text-on-surface-variant">No activity yet. Start by creating your first payout request.</div>
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
                <span className="text-sm font-semibold text-primary uppercase">{request.status}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
