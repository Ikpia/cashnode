import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import { Icon } from "@/components/ui/icon";
import { requireAdminUser } from "@/lib/auth-session";
import { listPaystackNigerianBanks } from "@/lib/paystack";
import {
  listAdminPayoutRequests,
  updateAdminSettlementStatus,
  type PayoutRequestRecord,
  type SettlementStatus
} from "@/lib/payout-requests";
import {
  listAdminUsers,
  updateAdminUserAccount,
  updateAgentReviewStatus,
  type AppUser,
  type OnboardingStatus
} from "@/lib/users";

function formatNgn(value: number) {
  return `NGN ${value.toLocaleString("en-NG")}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function adminStatusClass(status: string) {
  if (status === "active" || status === "transfer_success") {
    return "status-success";
  }

  if (status === "withdrawal_requested" || status === "recipient_created" || status === "transfer_pending") {
    return "status-live";
  }

  if (status === "transfer_failed") {
    return "status-pending !bg-[#fdeaea] !text-[#b42318]";
  }

  return "status-pending";
}

function readableStatus(status: string) {
  return status.replace(/_/g, " ");
}

const VALID_ONBOARDING_STATUSES = ["new", "onboarding", "active"] as const satisfies readonly OnboardingStatus[];
const VALID_SETTLEMENT_STATUSES = ["withdrawal_requested", "transfer_success", "transfer_failed"] as const;

function getAgentReviewLabel(user: AppUser) {
  if (!user.agentProfile) {
    return "Not POS";
  }

  if (user.agentProfile.manualReviewRequired) {
    return "Needs approval";
  }

  return user.agentProfile.isAvailable ? "Approved" : "Paused";
}

function MetricCard({
  label,
  value,
  helper,
  icon,
  tone = "primary"
}: {
  label: string;
  value: string;
  helper: string;
  icon: string;
  tone?: "primary" | "warm" | "success";
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "warm"
        ? "bg-amber-50 text-amber-700"
        : "bg-primary/10 text-primary";

  return (
    <div className="page-card p-6">
      <div className="mb-7 flex items-start justify-between">
        <span className="text-sm font-semibold uppercase tracking-[0.22em] text-on-surface-variant">{label}</span>
        <span className={`grid h-11 w-11 place-items-center rounded-2xl ${toneClass}`}>
          <Icon name={icon} filled />
        </span>
      </div>
      <div className="font-display text-[2.65rem] font-bold leading-none tracking-[-0.04em] text-on-surface">{value}</div>
      <p className="mt-3 text-sm text-on-surface-variant">{helper}</p>
    </div>
  );
}

function EmptyState({ children }: { children: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-5 py-8 text-center text-sm text-on-surface-variant">
      {children}
    </div>
  );
}

export default async function AdminPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; success?: string }>;
}) {
  await requireAdminUser();
  const resolvedSearchParams = (await searchParams) ?? {};
  const [users, payoutRequests, banks] = await Promise.all([
    listAdminUsers(),
    listAdminPayoutRequests(),
    listPaystackNigerianBanks().catch(() => [])
  ]);
  const userById = new Map(users.map((user) => [user.id, user]));
  const bankNameByCode = new Map(banks.map((bank) => [bank.code, bank.name]));

  const agents = users.filter((user) => user.agentProfile);
  const pendingAgents = agents.filter((user) => user.agentProfile?.manualReviewRequired);
  const activeAgents = agents.filter(
    (user) => user.onboardingStatus === "active" && user.agentProfile && !user.agentProfile.manualReviewRequired && user.agentProfile.isAvailable
  );
  const manualPaymentRequests = payoutRequests.filter(
    (request) => request.settlement?.status === "withdrawal_requested" || request.settlement?.status === "transfer_failed"
  );
  const manualPaymentAmount = manualPaymentRequests.reduce((sum, request) => sum + (request.settlement?.amountNgn ?? 0), 0);
  const completedPayouts = payoutRequests.filter((request) => request.status === "completed");

  async function reviewAgentAction(formData: FormData) {
    "use server";

    await requireAdminUser();
    const userId = String(formData.get("userId") ?? "");
    const approved = String(formData.get("approved") ?? "") === "true";

    try {
      await updateAgentReviewStatus({ userId, approved });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update POS agent review.";
      redirect(`/admin?error=${encodeURIComponent(message)}`);
    }

    revalidatePath("/admin");
    revalidatePath("/agent-dashboard");
    redirect(`/admin?success=${encodeURIComponent(approved ? "POS agent approved." : "POS agent returned to review.")}`);
  }

  async function userAccountAction(formData: FormData) {
    "use server";

    await requireAdminUser();
    const userId = String(formData.get("userId") ?? "");
    const onboardingStatusValue = String(formData.get("onboardingStatus") ?? "");

    if (!VALID_ONBOARDING_STATUSES.includes(onboardingStatusValue as OnboardingStatus)) {
      redirect(`/admin?error=${encodeURIComponent("Invalid onboarding status.")}`);
    }

    const onboardingStatus = onboardingStatusValue as OnboardingStatus;
    const isAvailableValue = String(formData.get("isAvailable") ?? "");
    const isAvailable = isAvailableValue === "" ? undefined : isAvailableValue === "true";

    try {
      await updateAdminUserAccount({ userId, onboardingStatus, isAvailable });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update user account.";
      redirect(`/admin?error=${encodeURIComponent(message)}`);
    }

    revalidatePath("/admin");
    revalidatePath("/agent-dashboard");
    redirect(`/admin?success=${encodeURIComponent("User account updated.")}`);
  }

  async function settlementAction(formData: FormData) {
    "use server";

    await requireAdminUser();
    const requestId = String(formData.get("requestId") ?? "");
    const statusValue = String(formData.get("status") ?? "");

    if (!VALID_SETTLEMENT_STATUSES.includes(statusValue as (typeof VALID_SETTLEMENT_STATUSES)[number])) {
      redirect(`/admin?error=${encodeURIComponent("Invalid settlement status.")}`);
    }

    const status = statusValue as Extract<SettlementStatus, "withdrawal_requested" | "transfer_success" | "transfer_failed">;
    const note = String(formData.get("note") ?? "");

    try {
      await updateAdminSettlementStatus({ requestId, status, note });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update manual payment.";
      redirect(`/admin?error=${encodeURIComponent(message)}`);
    }

    revalidatePath("/admin");
    revalidatePath("/agent-dashboard");
    revalidatePath("/request-detail");
    redirect(`/admin?success=${encodeURIComponent("Manual payment status updated.")}`);
  }

  return (
    <AppShell mainClassName="py-8">
      <header className="mb-10 overflow-hidden rounded-[2rem] bg-[#14251f] p-7 text-white shadow-[0_24px_80px_rgba(20,37,31,0.18)] md:p-9">
        <div className="grid gap-8 lg:grid-cols-[1fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#d8f7a5]">CashNode admin</p>
            <h1 className="mt-4 font-display text-[3.4rem] font-bold leading-[0.9] tracking-[-0.06em] md:text-[5rem]">
              Operations dashboard
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/72">
              Review POS onboarding, manage user account states, and manually close agent settlement payments from one control surface.
            </p>
          </div>
        </div>
      </header>

      {resolvedSearchParams.error ? (
        <div className="mb-8 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong className="font-semibold">Admin action failed: </strong>
          {resolvedSearchParams.error}
        </div>
      ) : null}

      {resolvedSearchParams.success ? (
        <div className="mb-8 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <strong className="font-semibold">Admin action complete: </strong>
          {resolvedSearchParams.success}
        </div>
      ) : null}

      <section className="mb-8 grid gap-gutter md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Users" value={String(users.length)} helper="Total signed-in CashNode accounts" icon="groups" />
        <MetricCard label="POS agents" value={String(activeAgents.length)} helper="Approved and available for matching" icon="storefront" tone="success" />
        <MetricCard label="Reviews" value={String(pendingAgents.length)} helper="POS onboarding requests waiting" icon="fact_check" tone="warm" />
        <MetricCard label="Manual queue" value={formatNgn(manualPaymentAmount)} helper={`${manualPaymentRequests.length} settlement item(s)`} icon="payments" />
      </section>

      <div className="grid gap-gutter xl:grid-cols-[0.95fr_1.05fr]">
        <section className="page-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-6 py-5">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-[-0.03em] text-on-surface">POS agent onboarding</h2>
              <p className="mt-1 text-sm text-on-surface-variant">Approve applications before POS accounts can accept payout work.</p>
            </div>
            <span className="status-pending">{pendingAgents.length} pending</span>
          </div>

          <div className="overflow-x-auto">
            {agents.length === 0 ? (
              <div className="p-6">
                <EmptyState>No POS agents have onboarded yet.</EmptyState>
              </div>
            ) : (
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-surface-container-low text-xs uppercase tracking-[0.18em] text-on-surface-variant">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Agent</th>
                    <th className="px-6 py-4 font-semibold">Business</th>
                    <th className="px-6 py-4 font-semibold">Capacity</th>
                    <th className="px-6 py-4 font-semibold">Review</th>
                    <th className="px-6 py-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {agents.map((agent) => (
                    <tr key={agent.id} className="align-top">
                      <td className="px-6 py-5">
                        <div className="font-semibold text-on-surface">{agent.displayName || agent.phoneNumber}</div>
                        <div className="mt-1 text-xs text-on-surface-variant">{agent.phoneNumber}</div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="font-medium text-on-surface">{agent.agentProfile?.businessName ?? "Profile incomplete"}</div>
                        <div className="mt-1 text-xs text-on-surface-variant">{agent.agentProfile?.serviceZone ?? "No hub saved"}</div>
                      </td>
                      <td className="px-6 py-5">
                        <div>{formatNgn(agent.agentProfile?.dailyCapacityNgn ?? 0)}</div>
                        <div className="mt-1 text-xs text-on-surface-variant">Max {formatNgn(agent.agentProfile?.maxSinglePayoutNgn ?? 0)}</div>
                      </td>
                      <td className="px-6 py-5">
                        <span className={adminStatusClass(agent.agentProfile?.manualReviewRequired ? "new" : agent.onboardingStatus)}>
                          {getAgentReviewLabel(agent)}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-2">
                          <form action={reviewAgentAction}>
                            <input type="hidden" name="userId" value={agent.id} />
                            <input type="hidden" name="approved" value="true" />
                            <AdminSubmitButton className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary/90">
                              Approve
                            </AdminSubmitButton>
                          </form>
                          <form action={reviewAgentAction}>
                            <input type="hidden" name="userId" value={agent.id} />
                            <input type="hidden" name="approved" value="false" />
                            <AdminSubmitButton className="rounded-full border border-stone-300 px-4 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container-low">
                              Send to review
                            </AdminSubmitButton>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="page-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-6 py-5">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-[-0.03em] text-on-surface">Manual payment queue</h2>
              <p className="mt-1 text-sm text-on-surface-variant">Close agent bank settlements when automatic transfer is unavailable.</p>
            </div>
            <span className="status-live">{manualPaymentRequests.length} item(s)</span>
          </div>

          <div className="space-y-4 p-5">
            {manualPaymentRequests.length === 0 ? (
              <EmptyState>No manual payments are waiting right now.</EmptyState>
            ) : (
              manualPaymentRequests.map((request) => {
                const assignedAgentUser = request.assignedAgent?.userId ? userById.get(request.assignedAgent.userId) : null;
                const settlementProfile = assignedAgentUser?.agentProfile ?? null;
                const bankName =
                  settlementProfile?.settlementBankName ||
                  (settlementProfile?.settlementBankCode ? bankNameByCode.get(settlementProfile.settlementBankCode) : null) ||
                  null;
                const hasSettlementAccount = Boolean(
                  settlementProfile?.settlementAccountName &&
                    settlementProfile.settlementAccountNumber &&
                    settlementProfile.settlementBankCode
                );

                return (
                  <article key={request.id} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-xl font-bold tracking-[-0.03em] text-on-surface">{request.reference}</h3>
                          <span className={adminStatusClass(request.settlement?.status ?? "not_started")}>
                            {readableStatus(request.settlement?.status ?? "not started")}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-on-surface-variant">
                          Agent: {request.assignedAgent?.name ?? "Unassigned"} · {request.assignedAgent?.phoneNumber ?? "No phone"}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-2xl font-bold text-on-surface">{formatNgn(request.settlement?.amountNgn ?? 0)}</div>
                        <div className="mt-1 text-xs text-on-surface-variant">Requested {formatDate(request.settlement?.initiatedAt)}</div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-primary/10 bg-primary/5 p-4">
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                        <Icon name="account_balance" className="text-base" />
                        Send bank transfer to
                      </div>
                      {hasSettlementAccount ? (
                        <div className="grid gap-3 text-sm md:grid-cols-4">
                          <div>
                            <div className="text-xs text-on-surface-variant">Account name</div>
                            <div className="mt-1 font-semibold text-on-surface">{settlementProfile?.settlementAccountName}</div>
                          </div>
                          <div>
                            <div className="text-xs text-on-surface-variant">Account number</div>
                            <div className="mt-1 font-mono text-base font-semibold text-on-surface">
                              {settlementProfile?.settlementAccountNumber}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-on-surface-variant">Bank name</div>
                            <div className="mt-1 font-semibold text-on-surface">{bankName ?? "Unknown bank"}</div>
                          </div>
                          <div>
                            <div className="text-xs text-on-surface-variant">Bank code</div>
                            <div className="mt-1 font-semibold text-on-surface">{settlementProfile?.settlementBankCode}</div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-[#b42318]">
                          No settlement bank details are saved for this assigned POS agent. Ask the agent to update onboarding before marking paid.
                        </p>
                      )}
                    </div>

                    <form action={settlementAction} className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
                      <input type="hidden" name="requestId" value={request.id} />
                      <input
                        name="note"
                        placeholder="Optional admin note or bank transfer reference"
                        className="rounded-2xl border border-stone-200 bg-surface-container-low px-4 py-3 text-sm outline-none transition focus:border-primary focus:bg-white"
                      />
                      <AdminSubmitButton
                        name="status"
                        value="transfer_success"
                        className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90"
                      >
                        Mark paid
                      </AdminSubmitButton>
                      <AdminSubmitButton
                        name="status"
                        value="transfer_failed"
                        className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                      >
                        Mark failed
                      </AdminSubmitButton>
                      <AdminSubmitButton
                        name="status"
                        value="withdrawal_requested"
                        className="rounded-2xl border border-stone-300 px-4 py-3 text-sm font-semibold text-on-surface transition hover:bg-surface-container-low"
                      >
                        Requeue
                      </AdminSubmitButton>
                    </form>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>

      <section className="page-card mt-8 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-6 py-5">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-[-0.03em] text-on-surface">User accounts</h2>
            <p className="mt-1 text-sm text-on-surface-variant">Manually activate, pause, or inspect all recent user accounts.</p>
          </div>
          <span className="status-success">{completedPayouts.length} completed payouts</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-surface-container-low text-xs uppercase tracking-[0.18em] text-on-surface-variant">
              <tr>
                <th className="px-6 py-4 font-semibold">User</th>
                <th className="px-6 py-4 font-semibold">Role</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">POS state</th>
                <th className="px-6 py-4 font-semibold">Last updated</th>
                <th className="px-6 py-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {users.map((user) => (
                <tr key={user.id} className="align-top">
                  <td className="px-6 py-5">
                    <div className="font-semibold text-on-surface">{user.displayName || "Unnamed account"}</div>
                    <div className="mt-1 text-xs text-on-surface-variant">{user.phoneNumber}</div>
                  </td>
                  <td className="px-6 py-5 capitalize">{user.role}</td>
                  <td className="px-6 py-5">
                    <span className={adminStatusClass(user.onboardingStatus)}>{user.onboardingStatus}</span>
                  </td>
                  <td className="px-6 py-5">{getAgentReviewLabel(user)}</td>
                  <td className="px-6 py-5 text-on-surface-variant">{formatDate(user.updatedAt)}</td>
                  <td className="px-6 py-5">
                    <div className="flex flex-wrap gap-2">
                      <form action={userAccountAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="onboardingStatus" value="active" />
                        <AdminSubmitButton className="rounded-full bg-stone-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-stone-700">
                          Activate
                        </AdminSubmitButton>
                      </form>
                      <form action={userAccountAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="onboardingStatus" value="onboarding" />
                        {user.agentProfile ? <input type="hidden" name="isAvailable" value="false" /> : null}
                        <AdminSubmitButton className="rounded-full border border-stone-300 px-4 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container-low">
                          Pause
                        </AdminSubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
