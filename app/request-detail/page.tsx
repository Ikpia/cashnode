import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PickupMapEmbed } from "@/components/pickup-map-embed";
import { Icon } from "@/components/ui/icon";
import { requireSignedInUser, getRoleHomePath } from "@/lib/auth-session";
import {
  acceptPayoutRequest,
  cancelPayoutRequest,
  completePayoutRequest,
  getLatestRelevantPayoutRequest,
  getPayoutRequestByIdForUser,
  type PayoutRequestRecord
} from "@/lib/payout-requests";
import { images } from "@/lib/cashnode-data";

type SearchParams =
  Promise<Record<string, string | string[] | undefined>>;

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function getStatusMeta(request: PayoutRequestRecord) {
  switch (request.status) {
    case "completed":
      return {
        label: "Completed",
        className: "status-success inline-flex"
      };
    case "accepted":
      return {
        label: "Agent Matched",
        className: "status-live inline-flex"
      };
    case "cancelled":
      return {
        label: "Cancelled",
        className: "inline-flex rounded-full bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-500"
      };
    default:
      return {
        label: "Awaiting Agent",
        className: "status-pending inline-flex"
      };
  }
}

function buildTimeline(request: PayoutRequestRecord) {
  return [
    {
      title: "Request initiated",
      time: formatDateTime(request.createdAt),
      copy: `Funds secured for ${formatUsd(request.totalUsd)}.`,
      done: true
    },
    {
      title: "Agent assigned",
      time: request.assignedAgent ? formatDateTime(request.assignedAgent.acceptedAt) : "Waiting for assignment",
      copy: request.assignedAgent
        ? `${request.assignedAgent.name} was matched as the closest live eligible agent and is ready to coordinate pickup.`
        : "A verified CashNode agent will pick up this request soon.",
      done: Boolean(request.assignedAgent),
      active: request.status === "open"
    },
    {
      title: "Pickup ready",
      time: request.status === "open" ? "Pending agent" : request.pickupLocation,
      copy: request.status === "open" ? "Pickup details unlock once an agent accepts." : "Use the collection code only at the assigned hub.",
      done: request.status === "completed",
      active: request.status === "accepted"
    },
    {
      title: "Funds released",
      time: request.completedAt ? formatDateTime(request.completedAt) : request.cancelledAt ? formatDateTime(request.cancelledAt) : "Waiting for confirmation",
      copy:
        request.status === "completed"
          ? "Cash was confirmed and the request was fully settled."
          : request.status === "cancelled"
            ? "This request was cancelled before pickup."
            : "",
      future: request.status !== "completed" && request.status !== "cancelled"
    }
  ];
}

export default async function RequestDetailPage({
  searchParams
}: {
  searchParams?: SearchParams;
}) {
  const user = await requireSignedInUser();
  const resolvedSearchParams = (await searchParams) ?? {};
  const requestIdValue = resolvedSearchParams.id;
  const requestId = Array.isArray(requestIdValue) ? requestIdValue[0] : requestIdValue;
  let request: PayoutRequestRecord | null = null;
  let accessError = "";

  try {
    request = requestId ? await getPayoutRequestByIdForUser(requestId, user) : await getLatestRelevantPayoutRequest(user);
  } catch (error) {
    accessError = error instanceof Error ? error.message : "Unable to load this request.";
  }

  async function acceptRequestAction(formData: FormData) {
    "use server";

    const agent = await requireSignedInUser();

    if (agent.role !== "agent") {
      redirect(getRoleHomePath(agent.role));
    }

    const updatedRequest = await acceptPayoutRequest({
      requestId: String(formData.get("requestId") ?? ""),
      agentUser: agent
    });

    revalidatePath("/agent-dashboard");
    revalidatePath("/sender-dashboard");
    revalidatePath("/receiver-portal");
    revalidatePath("/request-detail");
    revalidatePath("/payout-confirmation");
    redirect(`/request-detail?id=${updatedRequest.id}`);
  }

  async function completeRequestAction(formData: FormData) {
    "use server";

    const actor = await requireSignedInUser();
    const updatedRequest = await completePayoutRequest({
      requestId: String(formData.get("requestId") ?? ""),
      actorUser: actor
    });

    revalidatePath("/agent-dashboard");
    revalidatePath("/sender-dashboard");
    revalidatePath("/receiver-portal");
    revalidatePath("/request-detail");
    revalidatePath("/payout-confirmation");
    redirect(`/request-detail?id=${updatedRequest.id}`);
  }

  async function cancelRequestAction(formData: FormData) {
    "use server";

    const sender = await requireSignedInUser();
    const updatedRequest = await cancelPayoutRequest({
      requestId: String(formData.get("requestId") ?? ""),
      senderUser: sender
    });

    revalidatePath("/agent-dashboard");
    revalidatePath("/sender-dashboard");
    revalidatePath("/request-detail");
    revalidatePath("/payout-confirmation");
    redirect(`/request-detail?id=${updatedRequest.id}`);
  }

  const homeHref = getRoleHomePath(user.role);

  if (!request) {
    return (
      <AppShell activeNav="request" mobileActive="activity" mainClassName="py-6 md:py-8" mobileProfileHref={homeHref}>
        <div className="page-card p-8">
          <h1 className="font-display text-headline-lg text-on-surface">Request Details</h1>
          <p className="mt-3 text-body-lg text-on-surface-variant">
            {accessError || "No payout request is available yet for this account."}
          </p>
          <Link
            href={homeHref}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-md"
          >
            Back to workspace
            <Icon name="chevron_right" className="text-[18px]" />
          </Link>
        </div>
      </AppShell>
    );
  }

  const status = getStatusMeta(request);
  const timeline = buildTimeline(request);
  const canAccept = Boolean(user.agentProfile && user.walletAddress && request.status === "open");
  const canCancel = request.senderUserId === user.id && request.status === "open";
  const canComplete =
    request.status === "accepted" &&
    ((user.role === "agent" && request.assignedAgent?.userId === user.id) ||
      request.receiverPhone === user.phoneNumber ||
      request.senderUserId === user.id);

  return (
    <AppShell activeNav="request" mobileActive="activity" mainClassName="py-6 md:py-8" mobileProfileHref={homeHref}>
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="font-display text-headline-lg text-on-surface md:text-[2.45rem]">Collection Request</h1>
              <p className="text-body-lg text-on-surface-variant">ID: {request.reference}</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <span className={status.className}>{status.label}</span>
              <span className="text-body-md text-on-surface-variant">Updated {formatDateTime(request.updatedAt)}</span>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="page-card p-8">
              <div className="mb-6 flex items-start justify-between">
                <h3 className="font-display text-headline-md text-on-surface">Assigned Agent</h3>
                {request.assignedAgent ? <Icon name="verified" filled className="text-primary" /> : <span className="status-pending">Pending</span>}
              </div>

              <div className="mb-6 flex items-center gap-4">
                <div className="relative">
                  <img
                    src={images.assignedAgent}
                    alt="Assigned CashNode agent"
                    className={`h-16 w-16 rounded-full object-cover ${request.assignedAgent ? "" : "opacity-50 grayscale"}`}
                  />
                  {request.assignedAgent ? (
                    <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-primary">
                      <Icon name="star" filled className="text-[14px] text-white" />
                    </div>
                  ) : null}
                </div>
                <div>
                  <p className="font-display text-headline-md text-on-surface">
                    {request.assignedAgent?.name ?? "Waiting for assignment"}
                  </p>
                  <p className="text-body-md text-tertiary">
                    {request.assignedAgent ? `${request.assignedAgent.rating}` : "--"}
                    <span className="text-on-surface-variant">
                      {request.assignedAgent ? ` (${request.assignedAgent.transferCount} transfers)` : " · details appear after acceptance"}
                    </span>
                  </p>
                  {request.assignedAgent?.distanceLabel ? (
                    <p className="mt-1 text-sm text-on-surface-variant">
                      Closest active hub: {request.assignedAgent.distanceLabel} from the receiver&apos;s pickup point.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <a
                  href={
                    request.assignedAgent
                      ? `https://wa.me/${request.assignedAgent.phoneNumber.replace(/\D/g, "")}?text=${encodeURIComponent(
                          `Hello ${request.assignedAgent.name}, I am checking request ${request.reference}.`
                        )}`
                      : "#"
                  }
                  target="_blank"
                  rel="noreferrer"
                  className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold ${
                    request.assignedAgent
                      ? "bg-surface-container-low text-on-surface transition-colors hover:bg-surface-container"
                      : "cursor-not-allowed bg-surface-container-low text-stone-400"
                  }`}
                >
                  <Icon name="chat" className="text-[18px]" />
                  Message Agent
                </a>
                <a
                  href={request.assignedAgent ? `tel:${request.assignedAgent.phoneNumber}` : "#"}
                  className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold ${
                    request.assignedAgent
                      ? "border border-primary/15 bg-white text-primary transition-colors hover:bg-primary/5"
                      : "cursor-not-allowed border border-stone-200 bg-white text-stone-400"
                  }`}
                >
                  <Icon name="call" className="text-[18px]" />
                  Call Agent
                </a>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-primary p-8 text-white shadow-ambient">
              <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary-container/40" />
              <div>
                <h3 className="mb-2 font-display text-headline-md">Pickup Code</h3>
                <p className="max-w-[240px] text-sm text-white/80">
                  Share this code only at the pickup point when the assigned agent is present.
                </p>
              </div>

              <div className="mt-8 flex items-center justify-between rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-md">
                <div className="flex items-end gap-2 font-display text-[2.5rem] font-bold tracking-[0.18em] md:text-[2.9rem]">
                  <span>{request.collectionCode.slice(0, 3)}</span>
                  <span className="text-white/35">{request.collectionCode.slice(3)}</span>
                </div>
                <Icon name="visibility" className="text-white/70" />
              </div>

              <div className="mt-6 text-sm text-white/80">{request.pickupLocation}</div>
            </div>
          </div>

          <div className="page-card p-8">
            <h3 className="mb-6 font-display text-headline-md text-on-surface">Financial Summary</h3>
            <div className="space-y-4">
              {[
                { label: "Requested Amount", value: formatUsd(request.amountUsd) },
                { label: "Processing Fee", value: formatUsd(request.platformFeeUsd) },
                { label: "Agent Service Fee", value: formatUsd(request.agentFeeUsd) }
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between border-b border-surface-container py-2">
                  <span className="text-body-md text-on-surface-variant">{row.label}</span>
                  <span className="font-display text-headline-md text-on-surface">{row.value}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-5">
                <span className="font-display text-headline-md text-on-surface">Total Payable</span>
                <span className="font-display text-headline-lg text-primary">{formatUsd(request.totalUsd)}</span>
              </div>
            </div>

            <div className="mt-8 grid gap-4 border-t border-surface-container pt-6 md:grid-cols-2">
              <div>
                <span className="text-caption text-on-surface-variant">Receiver</span>
                <div className="mt-2 text-body-lg text-on-surface">{request.receiverName}</div>
                <div className="text-sm text-on-surface-variant">{request.receiverPhone}</div>
              </div>
              <div>
                <span className="text-caption text-on-surface-variant">Pickup area</span>
                <div className="mt-2 text-body-lg text-on-surface">{request.pickupArea}</div>
                <div className="text-sm text-on-surface-variant">{request.localCurrency} {request.estimatedLocalAmount.toLocaleString()}</div>
              </div>
            </div>

            {request.notes ? (
              <div className="mt-6 rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                <span className="mb-2 block font-semibold text-on-surface">Notes</span>
                {request.notes}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3">
            {canAccept ? (
              <form action={acceptRequestAction}>
                <input type="hidden" name="requestId" value={request.id} />
                <button type="submit" className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-md">
                  Accept Request
                </button>
              </form>
            ) : null}

            {canCancel ? (
              <form action={cancelRequestAction}>
                <input type="hidden" name="requestId" value={request.id} />
                <button type="submit" className="rounded-xl border border-stone-200 bg-white px-6 py-3 text-sm font-semibold text-on-surface">
                  Cancel Request
                </button>
              </form>
            ) : null}

            {canComplete ? (
              <form action={completeRequestAction}>
                <input type="hidden" name="requestId" value={request.id} />
                <button type="submit" className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-md">
                  Confirm Cash Collected
                </button>
              </form>
            ) : null}

            <Link href={`/payout-confirmation?id=${request.id}`} className="rounded-xl border border-primary/15 bg-white px-6 py-3 text-sm font-semibold text-primary">
              Open Pickup Pass
            </Link>
          </div>
        </div>

        <aside className="lg:col-span-4">
          <div className="page-card h-full p-8">
            <h3 className="mb-8 font-display text-headline-md text-on-surface">Request Lifecycle</h3>

            <div className="relative">
              <div className="absolute left-4 top-2 h-[calc(100%-1rem)] w-[2px] bg-surface-container-highest" />
              <div className="space-y-10">
                {timeline.map((step) => (
                  <div key={step.title} className={`relative pl-12 ${step.future ? "opacity-40" : ""}`}>
                    <div
                      className={`absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full ${
                        step.done ? "bg-primary" : step.active ? "border-2 border-primary bg-white" : "bg-surface-container-highest"
                      }`}
                    >
                      {step.done ? <Icon name="check" filled className="text-[16px] text-white" /> : null}
                      {step.active ? <div className="h-3 w-3 rounded-full bg-primary" /> : null}
                    </div>
                    <div>
                      <p className={`font-display text-[1.12rem] ${step.active ? "text-primary" : "text-on-surface"}`}>{step.title}</p>
                      <p className={`mt-1 ${step.active ? "text-primary" : "text-on-surface-variant"}`}>{step.time}</p>
                      {step.copy ? <p className="mt-2 text-body-lg text-on-surface-variant">{step.copy}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8">
              <PickupMapEmbed title={`${request.pickupArea} pickup map`} src={request.pickupMapEmbedUrl} className="h-44" />
            </div>

            <div className="mt-4 rounded-2xl bg-surface-container-low px-4 py-4 text-sm text-on-surface-variant">
              <div className="flex items-center justify-between gap-3">
                <span>GPS coordinates</span>
                <span className="font-semibold text-on-surface">{request.pickupCoordinatesLabel}</span>
              </div>
              <a
                href={request.pickupDirectionsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 font-semibold text-primary"
              >
                <Icon name="directions" className="text-[18px]" />
                Open exact pin
              </a>
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
