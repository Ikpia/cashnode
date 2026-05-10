import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireSignedInUser } from "@/lib/auth-session";
import { cancelPayoutRequest, listSenderPayoutRequests, type PayoutRequestRecord } from "@/lib/payout-requests";
import { getWelcomeGreeting } from "@/lib/user-greeting";
import { AppShell } from "@/components/app-shell";
import { SenderPayoutForm } from "@/components/sender-payout-form";
import { EscrowActionButton } from "@/components/escrow-action-button";
import { Icon } from "@/components/ui/icon";

function formatUsdt(value: number) {
  return `${value.toFixed(2)} USDT`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function getStatusMeta(status: PayoutRequestRecord["status"]) {
  switch (status) {
    case "accepted":
      return {
        label: "Agent Assigned",
        className: "status-live inline-flex"
      };
    case "completed":
      return {
        label: "Completed",
        className: "status-success inline-flex"
      };
    case "cancelled":
      return {
        label: "Cancelled",
        className: "inline-flex rounded-full bg-stone-100 px-3 py-1 text-sm font-semibold text-stone-500"
      };
    default:
      return {
        label: "Awaiting Agent",
        className: "status-pending inline-flex"
      };
  }
}

export default async function SenderDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const formError = resolvedSearchParams?.error;
  const user = await requireSignedInUser();
  const requests = await listSenderPayoutRequests(user.id);
  const latestRequest = requests[0] ?? null;
  const latestActiveRequest = requests.find((request) => request.status === "open" || request.status === "accepted") ?? latestRequest;
  const totalFlow = requests
    .filter((request) => request.status !== "cancelled")
    .reduce((sum, request) => sum + request.totalToken, 0);
  const welcomeGreeting = getWelcomeGreeting(user, "Welcome back.");

  async function cancelPayoutAction(formData: FormData) {
    "use server";

    const sender = await requireSignedInUser();
    await cancelPayoutRequest({
      requestId: String(formData.get("requestId") ?? ""),
      senderUser: sender
    });

    revalidatePath("/sender-dashboard");
    revalidatePath("/agent-dashboard");
    revalidatePath("/request-detail");
  }

  return (
    <AppShell activeNav="sender" mobileActive="home" mainClassName="pt-8">
      <div className="page-card relative mb-12 overflow-hidden p-8">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/5" />
        <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <p className="mb-2 text-sm font-semibold text-primary">{welcomeGreeting}</p>
            <p className="mb-2 text-sm text-stone-500">Total Sent</p>
            <h1 className="font-display text-[3.2rem] font-bold tracking-[-0.03em] text-on-surface">{formatUsdt(totalFlow || 0)}</h1>
            <span className="status-success mt-3 inline-flex">{requests.length} requests created</span>
          </div>

          <div className="flex w-full gap-3 md:w-auto">
            {latestRequest ? (
              <Link href={`/request-detail?id=${latestRequest.id}`} className="rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-white shadow-md">
                View Latest
              </Link>
            ) : (
              <span className="rounded-xl bg-stone-100 px-8 py-3 text-sm font-semibold text-stone-400">
                No requests yet
              </span>
            )}
            <Link href="/onboarding/sender" className="rounded-xl border border-stone-200 bg-white px-8 py-3 text-sm font-semibold text-on-surface">
              Update Setup
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-8">
          <section className="page-card p-8">
            <h2 className="mb-6 font-display text-headline-md text-on-surface">Create Payout Request</h2>
            <p className="mb-6 max-w-2xl text-sm text-on-surface-variant">
              Enter the receiver details, pick the nearest collection hub, and confirm the exact amount the receiver will collect in NGN.
            </p>

            <SenderPayoutForm initialError={formError ?? ""} />
          </section>

          <section className="page-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-stone-100 px-8 py-6">
              <h2 className="font-display text-headline-md text-on-surface">Recent Transactions</h2>
              <span className="text-sm font-semibold text-primary">{requests.length} total</span>
            </div>

            {requests.length === 0 ? (
              <div className="px-8 py-10 text-sm text-on-surface-variant">No payout requests yet. Create the first one above.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px]">
                  <thead className="bg-stone-50/60">
                    <tr>
                      {["Receiver", "Pickup", "Amount", "Status", "Action"].map((heading) => (
                        <th key={heading} className="px-8 py-4 text-left text-sm font-semibold text-stone-500">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {requests.map((request) => {
                      const status = getStatusMeta(request.status);
                      return (
                        <tr key={request.id}>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 font-semibold text-stone-600">
                                {request.receiverName
                                  .split(" ")
                                  .slice(0, 2)
                                  .map((name) => name[0])
                                  .join("")
                                  .toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-on-surface">{request.receiverName}</p>
                                <p className="text-sm text-stone-500">REF: {request.reference}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-5 text-on-surface-variant">
                            <div>{request.pickupArea}</div>
                            <div className="text-sm text-stone-500">{formatDate(request.updatedAt)}</div>
                          </td>
                          <td className="px-8 py-5">
                            <div className="text-lg font-semibold text-on-surface">Pay: {formatUsdt(request.totalToken)}</div>
                            {request.estimatedLocalAmount > 0 ? (
                              <div className="text-sm text-on-surface-variant">Receiver gets: {request.localCurrency} {request.estimatedLocalAmount.toLocaleString()}</div>
                            ) : null}
                          </td>
                          <td className="px-8 py-5">
                            <span className={status.className}>{status.label}</span>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <Link href={`/request-detail?id=${request.id}`} className="text-sm font-semibold text-primary">
                                View
                              </Link>
                              {request.status === "open" &&
                              (!request.escrow ||
                                request.escrow.status === "pending_signature" ||
                                request.escrow.status === "failed" ||
                                request.escrow.status === "cancelled") ? (
                                <form action={cancelPayoutAction}>
                                  <input type="hidden" name="requestId" value={request.id} />
                                  <button type="submit" className="text-sm font-semibold text-stone-500">
                                    Cancel
                                  </button>
                                </form>
                              ) : request.status === "open" && request.escrow?.status === "funded" ? (
                                <EscrowActionButton
                                  requestId={request.id}
                                  action="cancel"
                                  className="text-sm font-semibold text-stone-500"
                                >
                                  Cancel
                                </EscrowActionButton>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="lg:col-span-4">
          <div className="page-card sticky top-28 p-8">
            <h3 className="mb-6 font-display text-headline-md text-on-surface">Next Best Action</h3>

            {latestActiveRequest ? (
              <div className="space-y-4 rounded-2xl bg-stone-50 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-caption uppercase tracking-[0.14em] text-stone-500">Current payout</p>
                    <p className="text-lg font-semibold text-on-surface">{latestActiveRequest.receiverName}</p>
                    <p className="mt-1 text-sm text-on-surface-variant">Reference: {latestActiveRequest.reference}</p>
                  </div>
                  <Icon name="local_shipping" filled className="text-primary" />
                </div>

                <div className="rounded-2xl border border-white bg-white px-4 py-4 text-sm text-on-surface-variant shadow-soft">
                  {latestActiveRequest.status === "open"
                    ? "Agent matching is still in progress. Keep the receiver informed while CashNode finds the nearest handoff agent."
                    : latestActiveRequest.status === "accepted"
                      ? "Pickup is live. Open the request and guide the receiver with the assigned location and code instructions."
                      : "This payout is complete. Open the receipt to show the full proof of handoff and settlement status."}
                </div>

                <Link
                  href={`/request-detail?id=${latestActiveRequest.id}`}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-md"
                >
                  {latestActiveRequest.status === "completed" ? "Open receipt" : "Continue tracking"}
                  <Icon name="chevron_right" className="text-[18px]" />
                </Link>

                <a
                  href={latestActiveRequest.receiverWhatsAppUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-on-surface"
                >
                  <Icon name="chat" className="text-[18px]" />
                  Send receiver update
                </a>
              </div>
            ) : (
              <div className="rounded-2xl bg-stone-50 p-6 text-sm text-on-surface-variant">
                Your latest payout request will appear here once you create one.
              </div>
            )}

            <div className="mt-6 space-y-4">
              <Link
                href="/onboarding/sender"
                className="flex w-full items-center justify-between rounded-xl border border-stone-100 px-4 py-4 text-left transition-colors hover:bg-stone-50"
              >
                <span className="flex items-center gap-3">
                  <Icon name="manage_accounts" className="text-stone-400" />
                  <span className="font-semibold text-stone-700">Update sender setup</span>
                </span>
                <Icon name="chevron_right" className="text-stone-400" />
              </Link>
              <Link
                href="/support"
                className="flex w-full items-center justify-between rounded-xl border border-stone-100 px-4 py-4 text-left transition-colors hover:bg-stone-50"
              >
                <span className="flex items-center gap-3">
                  <Icon name="support_agent" className="text-stone-400" />
                  <span className="font-semibold text-stone-700">Priority support</span>
                </span>
                <Icon name="chevron_right" className="text-stone-400" />
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
