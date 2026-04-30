import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PickupMapEmbed } from "@/components/pickup-map-embed";
import { Icon } from "@/components/ui/icon";
import { requireSignedInUser, getRoleHomePath } from "@/lib/auth-session";
import { completePayoutRequest, getLatestRelevantPayoutRequest, getPayoutRequestByIdForUser } from "@/lib/payout-requests";

type SearchParams =
  Promise<Record<string, string | string[] | undefined>>;

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function formatCountdown(updatedAt: string) {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 60000));
  const remainingMinutes = Math.max(5, 30 - elapsedMinutes);
  const minutes = String(Math.floor(remainingMinutes)).padStart(2, "0");
  const seconds = "00";
  return `${minutes}:${seconds}`;
}

export default async function PayoutConfirmationPage({
  searchParams
}: {
  searchParams?: SearchParams;
}) {
  const user = await requireSignedInUser();
  const resolvedSearchParams = (await searchParams) ?? {};
  const requestIdValue = resolvedSearchParams.id;
  const requestId = Array.isArray(requestIdValue) ? requestIdValue[0] : requestIdValue;
  let request = null;
  let accessError = "";

  try {
    request = requestId ? await getPayoutRequestByIdForUser(requestId, user) : await getLatestRelevantPayoutRequest(user);
  } catch (error) {
    accessError = error instanceof Error ? error.message : "Unable to load the pickup pass.";
  }

  async function completePickupAction(formData: FormData) {
    "use server";

    const actor = await requireSignedInUser();
    const updatedRequest = await completePayoutRequest({
      requestId: String(formData.get("requestId") ?? ""),
      actorUser: actor
    });

    revalidatePath("/receiver-portal");
    revalidatePath("/sender-dashboard");
    revalidatePath("/agent-dashboard");
    revalidatePath("/request-detail");
    revalidatePath("/payout-confirmation");
    redirect(`/request-detail?id=${updatedRequest.id}`);
  }

  const homeHref = getRoleHomePath(user.role);

  if (!request) {
    return (
      <AppShell activeNav="payout" mobileActive="wallet" mainClassName="flex flex-col items-center py-8" mobileProfileHref={homeHref}>
        <div className="w-full max-w-2xl page-card p-8">
          <h1 className="font-display text-headline-lg text-on-surface">Pickup Pass</h1>
          <p className="mt-3 text-body-lg text-on-surface-variant">
            {accessError || "There is no active pickup pass for this account yet."}
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

  const canComplete =
    request.status === "accepted" &&
    ((user.role === "agent" && request.assignedAgent?.userId === user.id) ||
      request.receiverPhone === user.phoneNumber ||
      request.senderUserId === user.id);

  return (
    <AppShell activeNav="payout" mobileActive="wallet" mainClassName="flex flex-col items-center py-8" mobileProfileHref={homeHref}>
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-3 pt-4 text-center">
          <h1 className="font-display text-headline-lg text-on-surface">
            {request.status === "completed" ? "Payout Complete" : "Payout Ready"}
          </h1>
          <p className="text-body-lg text-on-surface-variant">
            Show this code at <span className="font-semibold text-primary">{request.pickupLocation}</span>
            {request.assignedAgent ? (
              <>
                {" "}
                with <span className="font-semibold text-primary">{request.assignedAgent.name}</span>
              </>
            ) : null}
          </p>
          {request.assignedAgent?.distanceLabel ? (
            <p className="text-sm text-on-surface-variant">
              CashNode matched the nearest live eligible agent, {request.assignedAgent.distanceLabel} from this pickup point.
            </p>
          ) : null}
        </div>

        <section className="page-card rounded-[2rem] p-8 text-center">
          <span className="mb-6 inline-block text-sm font-semibold uppercase tracking-[0.3em] text-on-surface">Verification Code</span>
          <div className="mb-8 flex items-center justify-center gap-2">
            {[...request.collectionCode].map((digit, index) => (
              <div
                key={`${digit}-${index}`}
                className="flex h-16 w-12 items-center justify-center rounded-xl border border-outline-variant bg-surface-container text-[1.95rem] font-semibold text-primary shadow-inner"
              >
                {digit}
              </div>
            ))}
          </div>

          <div className="status-live inline-flex items-center gap-2 px-5 py-3 text-base">
            <Icon name="timer" filled className="text-secondary" />
            {request.status === "completed" ? "Used" : `Expires in ${formatCountdown(request.updatedAt)}`}
          </div>
        </section>

        <section className="page-card rounded-[1.75rem] p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-headline-md text-on-surface">{request.pickupArea}</h2>
              <p className="text-body-lg text-on-surface-variant">{request.pickupLocation}</p>
            </div>
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[1.5rem] bg-primary-fixed p-4">
              <Icon name="store" filled className="text-[28px] text-primary" />
            </div>
          </div>

          <PickupMapEmbed title={`${request.pickupArea} collection map`} src={request.pickupMapEmbedUrl} className="mb-4 h-40" />

          <div className="mb-4 flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
            <span>GPS Coordinates</span>
            <span className="font-semibold text-on-surface">{request.pickupCoordinatesLabel}</span>
          </div>

          <div className="flex gap-4">
            <a
              href={request.pickupDirectionsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-surface-container-high px-5 py-4 text-body-lg font-semibold text-on-surface"
            >
              <Icon name="directions" className="text-[18px]" />
              Get Directions
            </a>
            <a
              href={request.assignedAgent ? `tel:${request.assignedAgent.phoneNumber}` : "tel:+2348001110000"}
              className="flex h-14 w-14 items-center justify-center rounded-xl bg-surface-container-high text-on-surface"
            >
              <Icon name="phone" className="text-[18px]" />
            </a>
          </div>
        </section>

        <section className="page-card rounded-[1.75rem] p-6">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-body-lg text-on-surface">Amount to Receive</span>
            <span className="font-display text-headline-md text-primary">{formatUsd(request.amountUsd)}</span>
          </div>
          <div className="mb-2 flex items-center justify-between text-on-surface-variant">
            <span className="text-body-lg">Request ID</span>
            <span className="font-mono text-body-lg">{request.reference}</span>
          </div>
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-body-lg">Receiver</span>
            <span className="text-body-lg">{request.receiverName}</span>
          </div>
        </section>

        <div className="space-y-4 pb-10">
          {canComplete ? (
            <form action={completePickupAction}>
              <input type="hidden" name="requestId" value={request.id} />
              <button type="submit" className="w-full rounded-full bg-primary px-6 py-5 text-lg font-semibold text-white shadow-md">
                I&apos;ve Received the Cash
              </button>
            </form>
          ) : null}

          <Link
            href={`/request-detail?id=${request.id}`}
            className="block w-full rounded-full border border-stone-200 px-6 py-4 text-center text-lg font-medium text-on-surface-variant"
          >
            View Request Details
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
