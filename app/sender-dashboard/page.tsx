import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserRole } from "@/lib/auth-session";
import { cancelPayoutRequest, createPayoutRequest, listSenderPayoutRequests, type PayoutRequestRecord } from "@/lib/payout-requests";
import { lagosPickupLocations } from "@/lib/pickup-locations";
import { getWelcomeGreeting } from "@/lib/user-greeting";
import { updateUserProfile } from "@/lib/users";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/ui/icon";

const pickupAreas = lagosPickupLocations.map((location) => location.area);

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

function buildTrackingSteps(request: PayoutRequestRecord | null) {
  if (!request) {
    return [];
  }

  return [
    {
      title: "Funds Secured",
      time: formatDate(request.createdAt),
      done: true
    },
    {
      title: "Agent Assigned",
      time: request.assignedAgent ? formatDate(request.assignedAgent.acceptedAt) : "Waiting for an agent",
      done: Boolean(request.assignedAgent),
      active: !request.assignedAgent
    },
    {
      title: "Pickup Ready",
      time: request.assignedAgent ? request.pickupLocation : "Location shared after assignment",
      done: request.status === "completed",
      active: request.status === "accepted"
    },
    {
      title: "Cash Released",
      time: request.completedAt ? formatDate(request.completedAt) : "Waiting for confirmation",
      done: request.status === "completed"
    }
  ];
}

export default async function SenderDashboardPage() {
  const user = await requireUserRole("sender");
  const requests = await listSenderPayoutRequests(user.id);
  const latestRequest = requests[0] ?? null;
  const latestActiveRequest = requests.find((request) => request.status === "open" || request.status === "accepted") ?? latestRequest;
  const trackingSteps = buildTrackingSteps(latestActiveRequest);
  const totalFlow = requests
    .filter((request) => request.status !== "cancelled")
    .reduce((sum, request) => sum + request.totalUsd, 0);
  const welcomeGreeting = getWelcomeGreeting(user, "Welcome back.");

  async function createPayoutAction(formData: FormData) {
    "use server";

    const sender = await requireUserRole("sender");
    const payoutRequest = await createPayoutRequest({
      senderUser: sender,
      amountUsd: Number(formData.get("amountUsd") ?? 0),
      receiverName: String(formData.get("receiverName") ?? ""),
      receiverPhone: String(formData.get("receiverPhone") ?? ""),
      pickupArea: String(formData.get("pickupArea") ?? ""),
      notes: String(formData.get("notes") ?? "")
    });

    if (sender.onboardingStatus !== "active") {
      await updateUserProfile({
        userId: sender.id,
        onboardingStatus: "active"
      });
    }

    revalidatePath("/sender-dashboard");
    revalidatePath("/agent-dashboard");
    revalidatePath("/receiver-portal");
    revalidatePath("/request-detail");
    revalidatePath("/payout-confirmation");
    redirect(`/request-detail?id=${payoutRequest.id}`);
  }

  async function cancelPayoutAction(formData: FormData) {
    "use server";

    const sender = await requireUserRole("sender");
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
            <p className="mb-2 text-sm text-stone-500">Total Payout Flow</p>
            <h1 className="font-display text-[3.2rem] font-bold tracking-[-0.03em] text-on-surface">{formatUsd(totalFlow || 0)}</h1>
            <span className="status-success mt-3 inline-flex">{requests.length} requests created</span>
          </div>

          <div className="flex w-full gap-3 md:w-auto">
            <Link href={latestRequest ? `/request-detail?id=${latestRequest.id}` : "#"} className="rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-white shadow-md">
              View Latest
            </Link>
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

            <form action={createPayoutAction} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-stone-600">Amount (USD)</span>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">$</span>
                    <input
                      name="amountUsd"
                      type="number"
                      min="1"
                      step="0.01"
                      required
                      placeholder="0.00"
                      className="w-full rounded-xl border border-stone-200 px-4 py-3 pl-8 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                    />
                  </div>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-stone-600">Receiver Name</span>
                  <input
                    name="receiverName"
                    type="text"
                    required
                    placeholder="Full legal name"
                    className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-stone-600">Receiver Phone</span>
                  <input
                    name="receiverPhone"
                    type="tel"
                    required
                    placeholder="+234 800 000 0000"
                    className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-stone-600">Pickup Location</span>
                  <select
                    name="pickupArea"
                    className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                    defaultValue={pickupAreas[0]}
                  >
                    {pickupAreas.map((area) => (
                      <option key={area}>{area}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-stone-600">Notes (Optional)</span>
                <textarea
                  name="notes"
                  rows={4}
                  placeholder="Purpose of payment..."
                  className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                />
              </label>

              <div className="rounded-2xl bg-primary/5 px-4 py-4 text-sm text-on-surface-variant">
                CashNode will try to match the closest live eligible POS agent to the receiver&apos;s selected pickup area as soon as you create this payout.
              </div>

              <button type="submit" className="primary-gradient w-full rounded-xl px-6 py-4 text-lg font-semibold text-white shadow-md">
                Initiate Payout
              </button>
            </form>
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
                          <td className="px-8 py-5 text-lg font-semibold text-on-surface">{formatUsd(request.totalUsd)}</td>
                          <td className="px-8 py-5">
                            <span className={status.className}>{status.label}</span>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <Link href={`/request-detail?id=${request.id}`} className="text-sm font-semibold text-primary">
                                View
                              </Link>
                              {request.status === "open" ? (
                                <form action={cancelPayoutAction}>
                                  <input type="hidden" name="requestId" value={request.id} />
                                  <button type="submit" className="text-sm font-semibold text-stone-500">
                                    Cancel
                                  </button>
                                </form>
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
            <h3 className="mb-6 font-display text-headline-md text-on-surface">Active Tracking</h3>

            {latestActiveRequest ? (
              <div className="rounded-2xl bg-stone-50 p-6">
                <div className="mb-6 flex items-start justify-between">
                  <div>
                    <p className="text-caption uppercase tracking-[0.14em] text-stone-500">Current Payout</p>
                    <p className="text-lg font-semibold text-on-surface">
                      {latestActiveRequest.receiverName} ({formatUsd(latestActiveRequest.totalUsd)})
                    </p>
                  </div>
                  <Icon name="local_shipping" filled className="text-primary" />
                </div>

                <div className="relative">
                  <div className="absolute left-[11px] top-2 h-[calc(100%-1rem)] w-[2px] bg-stone-200" />

                  <div className="space-y-6">
                    {trackingSteps.map((step) => (
                      <div key={step.title} className="relative flex gap-4">
                        <div
                          className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-4 border-stone-50 ${
                            step.done ? "bg-primary" : step.active ? "border-2 border-primary bg-white" : "bg-stone-200"
                          }`}
                        >
                          {step.done ? <Icon name="check" filled className="text-[12px] text-white" /> : null}
                          {step.active ? <div className="h-2 w-2 rounded-full bg-primary" /> : null}
                        </div>
                        <div>
                          <p className={`font-semibold ${step.active ? "text-primary" : step.done ? "text-on-surface" : "text-stone-400"}`}>
                            {step.title}
                          </p>
                          <p className={`text-sm ${step.active ? "text-on-surface-variant" : step.done ? "text-stone-500" : "text-stone-400"}`}>
                            {step.time}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-stone-50 p-6 text-sm text-on-surface-variant">
                Your latest payout request will appear here once you create one.
              </div>
            )}

            <div className="mt-6 space-y-4">
              {[
                { icon: "support_agent", label: "Priority Support" },
                { icon: "shield_with_heart", label: "Insurance Policy" }
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl border border-stone-100 px-4 py-4 text-left transition-colors hover:bg-stone-50"
                >
                  <span className="flex items-center gap-3">
                    <Icon name={item.icon} className="text-stone-400" />
                    <span className="font-semibold text-stone-700">{item.label}</span>
                  </span>
                  <Icon name="chevron_right" className="text-stone-400" />
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
