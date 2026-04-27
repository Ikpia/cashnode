import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AgentLivePresencePanel } from "@/components/agent-live-presence-panel";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/ui/icon";
import { requireUserRole } from "@/lib/auth-session";
import {
  acceptPayoutRequest,
  completePayoutRequest,
  listAssignedAgentPayoutRequests,
  listAvailablePayoutRequests,
  type PayoutRequestRecord
} from "@/lib/payout-requests";
import { getWelcomeGreeting } from "@/lib/user-greeting";

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function statusMeta(status: PayoutRequestRecord["status"]) {
  switch (status) {
    case "completed":
      return { label: "Completed", className: "status-success" };
    case "accepted":
      return { label: "Ready", className: "status-live" };
    default:
      return { label: "Open", className: "status-pending" };
  }
}

export default async function AgentDashboardPage() {
  const user = await requireUserRole("agent");
  const [availableRequests, assignedRequests] = await Promise.all([
    listAvailablePayoutRequests(user),
    listAssignedAgentPayoutRequests(user.id)
  ]);

  const activeAssignments = assignedRequests.filter((request) => request.status === "accepted");
  const completedAssignments = assignedRequests.filter((request) => request.status === "completed");
  const earnings = completedAssignments.reduce((sum, request) => sum + request.agentFeeUsd, 0);
  const averageSpeedMinutes = activeAssignments.length > 0 ? 12 : 0;
  const welcomeGreeting = getWelcomeGreeting(user, "Welcome back.");

  async function acceptRequestAction(formData: FormData) {
    "use server";

    const agent = await requireUserRole("agent");
    const request = await acceptPayoutRequest({
      requestId: String(formData.get("requestId") ?? ""),
      agentUser: agent
    });

    revalidatePath("/agent-dashboard");
    revalidatePath("/sender-dashboard");
    revalidatePath("/receiver-portal");
    revalidatePath("/request-detail");
    revalidatePath("/payout-confirmation");
    redirect(`/request-detail?id=${request.id}`);
  }

  async function completeRequestAction(formData: FormData) {
    "use server";

    const agent = await requireUserRole("agent");
    const request = await completePayoutRequest({
      requestId: String(formData.get("requestId") ?? ""),
      actorUser: agent
    });

    revalidatePath("/agent-dashboard");
    revalidatePath("/sender-dashboard");
    revalidatePath("/receiver-portal");
    revalidatePath("/request-detail");
    revalidatePath("/payout-confirmation");
    redirect(`/request-detail?id=${request.id}`);
  }

  return (
    <AppShell activeNav="agent" mobileActive="profile" showAvatar showMobileLabels mainClassName="pt-8">
      <header className="mb-12 space-y-2">
        <p className="text-sm font-semibold text-primary">{welcomeGreeting}</p>
        <h1 className="font-display text-headline-lg text-on-surface">Agent Dashboard</h1>
        <p className="text-body-lg text-on-surface-variant">Manage liquidity, receive nearby payout matches, and close completed handoffs.</p>
      </header>

      <AgentLivePresencePanel
        fallbackHub={user.agentProfile?.serviceZone ?? "Saved agent hub"}
        fallbackAddress={user.agentProfile?.serviceAddress ?? "Save an agent hub during onboarding to anchor live dispatch."}
        fallbackLatitude={user.agentProfile?.serviceLatitude ?? null}
        fallbackLongitude={user.agentProfile?.serviceLongitude ?? null}
      />

      <div className="grid gap-gutter md:grid-cols-12">
        <div className="space-y-8 md:col-span-8">
          <div className="grid gap-gutter sm:grid-cols-2">
            <div className="page-card p-8">
              <div className="mb-6 flex items-start justify-between">
                <span className="text-sm font-semibold text-on-surface-variant">Earnings summary</span>
                <span className="status-success">Live</span>
              </div>
              <div className="mb-2 font-display text-[3.1rem] font-bold tracking-[-0.03em] text-primary">{formatUsd(earnings)}</div>
              <p className="text-body-md text-on-surface-variant">Agent service fees earned from completed payouts</p>
              <div className="mt-8 h-1.5 rounded-full bg-surface-container-high">
                <div className="h-full w-3/4 rounded-full bg-primary" />
              </div>
            </div>

            <div className="page-card p-8">
              <div className="mb-6 flex items-start justify-between">
                <span className="text-sm font-semibold text-on-surface-variant">Liquidity / stake</span>
                <Icon name="account_balance_wallet" filled className="text-primary" />
              </div>
              <div className="mb-2 font-display text-[3.1rem] font-bold tracking-[-0.03em] text-on-surface">
                {activeAssignments.length + availableRequests.length}
                <span className="text-body-lg font-normal text-on-surface-variant"> live requests</span>
              </div>
              <p className="text-body-md text-on-surface-variant">Open opportunities and active assignments on your desk</p>
              <div className="mt-8 flex gap-3">
                <Link href="/onboarding/agent" className="flex-1 rounded-xl bg-surface-container px-5 py-3 text-center text-sm font-semibold text-on-surface">
                  Manage stake
                </Link>
                <Link href="/request-detail" className="flex-1 rounded-xl bg-primary px-5 py-3 text-center text-sm font-semibold text-white shadow-md">
                  View details
                </Link>
              </div>
            </div>
          </div>

          <section>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-headline-md text-on-surface">Overflow Requests</h2>
              <div className="text-sm font-semibold text-on-surface-variant">{availableRequests.length} open</div>
            </div>

            <div className="space-y-4">
              {availableRequests.length === 0 ? (
                <div className="page-card p-6 text-sm text-on-surface-variant">
                  No unmatched requests are available right now. Stay live to receive nearby auto-matches and to see any overflow requests that still need claiming.
                </div>
              ) : (
                availableRequests.map((request) => (
                  <div key={request.id} className="page-card flex flex-col gap-6 p-6 transition-transform hover:-translate-y-0.5 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container">
                        <Icon name="person_pin_circle" filled className="text-primary" />
                      </div>
                      <div>
                        <div className="text-xl font-semibold text-on-surface">{request.pickupArea}</div>
                        <div className="text-sm text-on-surface-variant">{`${request.reference} · ${request.receiverName} · ${formatDate(request.createdAt)}`}</div>
                      </div>
                    </div>

                    <div className="md:text-center">
                      <div className="font-display text-[2.1rem] font-bold tracking-[-0.03em] text-on-surface">{formatUsd(request.totalUsd)}</div>
                      <div className="text-sm font-semibold text-primary">Reward: {formatUsd(request.agentFeeUsd)}</div>
                    </div>

                    <form action={acceptRequestAction}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <button type="submit" className="rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-white shadow-md">
                        Accept
                      </button>
                    </form>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-8 md:col-span-4">
          <div className="page-card p-8">
            <h3 className="mb-6 font-display text-headline-md text-on-surface">Agent Performance</h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-caption text-on-surface-variant">Rating</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Icon name="star" filled className="text-tertiary" />
                    <span className="font-display text-headline-md text-on-surface">4.98</span>
                    <span className="text-on-surface-variant">/ 5.0</span>
                  </div>
                </div>
                <span className="status-success">Active</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-surface-container-low p-4">
                  <div className="text-caption text-on-surface-variant">Completed</div>
                  <div className="text-[1.75rem] font-bold text-on-surface">{completedAssignments.length}</div>
                </div>
                <div className="rounded-xl bg-surface-container-low p-4">
                  <div className="text-caption text-on-surface-variant">Avg. Speed</div>
                  <div className="text-[1.75rem] font-bold text-on-surface">{averageSpeedMinutes ? `${averageSpeedMinutes}m` : "--"}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Active pickups</span>
                  <span className="font-semibold text-primary">{activeAssignments.length}</span>
                </div>
                <div className="h-2 rounded-full bg-surface-container">
                  <div className="h-full w-[70%] rounded-full bg-primary" />
                </div>
              </div>
            </div>
          </div>

          <div className="page-card p-8">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-display text-headline-md text-on-surface">Active Payouts</h3>
              <span className="status-live">{activeAssignments.length} Active</span>
            </div>

            <div className="space-y-6">
              {activeAssignments.length === 0 ? (
                <div className="text-sm text-on-surface-variant">Accepted requests will show up here once you take one.</div>
              ) : (
                activeAssignments.map((request) => {
                  const meta = statusMeta(request.status);

                  return (
                    <div key={request.id} className="rounded-r-xl border-l-4 border-primary bg-surface-container-lowest p-4">
                      <div className="mb-2 flex items-start justify-between">
                        <span className="font-semibold text-on-surface">{request.reference}</span>
                        <span className={`text-sm font-semibold ${meta.className}`}>{meta.label}</span>
                      </div>
                      <div className="mb-1 text-[1.75rem] font-bold text-on-surface">{formatUsd(request.totalUsd)}</div>
                      <div className="text-body-md text-on-surface-variant">Receiver: {request.receiverName}</div>
                      <div className="mt-1 text-sm text-on-surface-variant">{request.pickupLocation}</div>
                      <div className="mt-4 flex gap-3">
                        <Link href={`/request-detail?id=${request.id}`} className="flex-1 rounded-xl bg-surface-container-high px-4 py-3 text-center text-sm font-semibold text-on-surface">
                          View
                        </Link>
                        <form action={completeRequestAction} className="flex-1">
                          <input type="hidden" name="requestId" value={request.id} />
                          <button type="submit" className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white">
                            Mark paid
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
