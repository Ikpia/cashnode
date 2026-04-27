import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserRole } from "@/lib/auth-session";
import { completePayoutRequest, listReceiverPayoutRequests, type PayoutRequestRecord } from "@/lib/payout-requests";
import { getWelcomeGreeting } from "@/lib/user-greeting";
import { AppShell } from "@/components/app-shell";
import { PickupMapEmbed } from "@/components/pickup-map-embed";
import { Icon } from "@/components/ui/icon";
import { images } from "@/lib/cashnode-data";

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function buildPickupTimeline(request: PayoutRequestRecord | null) {
  if (!request) {
    return [];
  }

  return [
    {
      title: "Request confirmed",
      time: new Date(request.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
      copy: "Your sender secured the payout and shared your pickup details.",
      done: true
    },
    {
      title: "Agent assigned",
      time: request.assignedAgent
        ? new Date(request.assignedAgent.acceptedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
        : "Waiting for assignment",
      copy: request.assignedAgent
        ? `${request.assignedAgent.name} was matched as the closest live eligible cash-out agent and is ready for handoff.`
        : "A nearby agent will accept the request soon.",
      done: Boolean(request.assignedAgent),
      active: !request.assignedAgent
    },
    {
      title: "Pickup ready",
      time: request.status === "completed" ? "Completed" : request.pickupLocation,
      copy: request.status === "completed" ? "Cash collected successfully." : `Bring your code to ${request.pickupLocation}.`,
      done: request.status === "completed",
      active: request.status === "accepted"
    },
    {
      title: "Cash collected",
      time: request.completedAt
        ? new Date(request.completedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
        : "Waiting for confirmation",
      copy: request.status === "completed" ? "This payout has been fully settled." : "",
      future: request.status !== "completed"
    }
  ];
}

export default async function ReceiverPortalPage() {
  const user = await requireUserRole("receiver");
  const requests = await listReceiverPayoutRequests(user.phoneNumber);
  const activeRequest = requests.find((request) => request.status === "accepted" || request.status === "open") ?? requests[0] ?? null;
  const pickupTimeline = buildPickupTimeline(activeRequest);
  const welcomeGreeting = getWelcomeGreeting(user, "Welcome back.");

  async function completePickupAction(formData: FormData) {
    "use server";

    const receiver = await requireUserRole("receiver");
    const request = await completePayoutRequest({
      requestId: String(formData.get("requestId") ?? ""),
      actorUser: receiver
    });

    revalidatePath("/receiver-portal");
    revalidatePath("/sender-dashboard");
    revalidatePath("/agent-dashboard");
    revalidatePath("/request-detail");
    revalidatePath("/payout-confirmation");
    redirect(`/request-detail?id=${request.id}`);
  }

  return (
    <AppShell
      activeNav="receiver"
      mobileActive="profile"
      mobileProfileHref="/receiver-portal"
      showAvatar
      showMobileLabels
      mainClassName="pt-8"
    >
      {activeRequest ? (
        <>
          <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <span className="status-live inline-flex">
                {activeRequest.status === "completed" ? "Pickup complete" : activeRequest.status === "accepted" ? "Pickup ready" : "Awaiting agent"}
              </span>
              <div>
                <p className="text-sm font-semibold text-primary">{welcomeGreeting}</p>
                <h1 className="font-display text-headline-lg text-on-surface">Receiver Portal</h1>
                <p className="mt-2 max-w-2xl text-body-lg text-on-surface-variant">
                  Track your pickup, see your assigned agent, and keep your collection code ready.
                </p>
              </div>
            </div>

            <div className="page-card min-w-[280px] rounded-[1.75rem] p-5">
              <div className="mb-2 text-sm font-semibold text-on-surface-variant">Amount available</div>
              <div className="font-display text-[2rem] font-bold tracking-[-0.03em] text-primary">{formatUsd(activeRequest.amountUsd)}</div>
              <div className="mt-2 text-sm text-on-surface-variant">Reference: {activeRequest.reference}</div>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-12">
            <div className="space-y-8 lg:col-span-8">
              <section className="relative overflow-hidden rounded-[2rem] bg-primary p-6 text-white shadow-ambient md:p-8">
                <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-white/10" />
                <div className="absolute -bottom-16 left-10 h-32 w-32 rounded-full bg-primary-container/30" />

                <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                  <div className="max-w-sm">
                    <div className="mb-3 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white">
                      Collection code
                    </div>
                    <h2 className="font-display text-headline-md text-white">Show this only at pickup</h2>
                    <p className="mt-2 text-sm text-white/80">The code is tied to this request and expires after collection.</p>
                  </div>

                  <div className="rounded-[1.75rem] border border-white/15 bg-white/10 px-5 py-6 text-center backdrop-blur-md">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-white/65">Code</div>
                    <div className="font-display text-[2.4rem] font-bold tracking-[0.26em] text-white md:text-[2.9rem]">
                      {activeRequest.collectionCode.slice(0, 3)} {activeRequest.collectionCode.slice(3)}
                    </div>
                    <div className="mt-3 text-sm text-white/75">{activeRequest.status === "completed" ? "Already used" : "Use once at pickup"}</div>
                  </div>
                </div>
              </section>

              <div className="grid gap-6 md:grid-cols-2">
                <section className="page-card p-6 md:p-8">
                  <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-display text-headline-md text-on-surface">Assigned Agent</h2>
                      <p className="mt-2 text-body-md text-on-surface-variant">Your pickup is being handled by a verified CashNode agent.</p>
                    </div>
                    <span className="status-success inline-flex">{activeRequest.assignedAgent ? "Verified" : "Pending"}</span>
                  </div>

                  <div className="mb-6 flex items-center gap-4">
                    <img src={images.assignedAgent} alt="Assigned CashNode agent" className="h-16 w-16 rounded-full object-cover" />
                    <div>
                      <div className="font-display text-[1.35rem] font-semibold text-on-surface">
                        {activeRequest.assignedAgent?.name ?? "Waiting for assignment"}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-sm text-on-surface-variant">
                        <Icon name="star" filled className="text-tertiary" />
                        {activeRequest.assignedAgent ? `${activeRequest.assignedAgent.rating} rating` : "Agent details will appear soon"}
                      </div>
                      <div className="mt-1 text-sm text-on-surface-variant">
                        {activeRequest.assignedAgent
                          ? `Usually completes handoff in under 10 minutes.`
                          : "We will notify you once a nearby agent accepts the request."}
                      </div>
                      {activeRequest.assignedAgent?.distanceLabel ? (
                        <div className="mt-1 text-sm text-on-surface-variant">
                          {activeRequest.assignedAgent.distanceLabel} from your selected pickup point.
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <a
                      href={
                        activeRequest.assignedAgent
                          ? `https://wa.me/${activeRequest.assignedAgent.phoneNumber.replace(/\D/g, "")}?text=${encodeURIComponent(
                              `Hello ${activeRequest.assignedAgent.name}, I am coming for pickup ${activeRequest.reference}.`
                            )}`
                          : "#"
                      }
                      target="_blank"
                      rel="noreferrer"
                      className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold ${
                        activeRequest.assignedAgent
                          ? "bg-surface-container-low text-on-surface transition-colors hover:bg-surface-container"
                          : "cursor-not-allowed bg-surface-container-low text-stone-400"
                      }`}
                    >
                      <Icon name="chat" className="text-[18px]" />
                      Message Agent
                    </a>
                    <a
                      href={activeRequest.assignedAgent ? `tel:${activeRequest.assignedAgent.phoneNumber}` : "#"}
                      className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold ${
                        activeRequest.assignedAgent
                          ? "border border-primary/15 bg-white text-primary transition-colors hover:bg-primary/5"
                          : "cursor-not-allowed border border-stone-200 bg-white text-stone-400"
                      }`}
                    >
                      <Icon name="call" className="text-[18px]" />
                      Call Agent
                    </a>
                  </div>
                </section>

                <section className="page-card p-6 md:p-8">
                  <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-display text-headline-md text-on-surface">Pickup Location</h2>
                      <p className="mt-2 text-body-md text-on-surface-variant">{activeRequest.pickupLocation}</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon name="location_on" filled />
                    </div>
                  </div>

                  <div className="mb-6">
                    <PickupMapEmbed title={`${activeRequest.pickupArea} pickup map`} src={activeRequest.pickupMapEmbedUrl} className="h-44" />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <a
                      href={activeRequest.pickupDirectionsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-md transition-transform hover:-translate-y-0.5"
                    >
                      <Icon name="directions" className="text-[18px]" />
                      Get Directions
                    </a>
                    <div className="flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-on-surface">
                      <Icon name="my_location" className="text-[18px]" />
                      {activeRequest.pickupCoordinatesLabel}
                    </div>
                  </div>
                </section>
              </div>

              <section className="page-card p-6 md:p-8">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="font-display text-headline-md text-on-surface">Pickup Steps</h2>
                  <span className="text-sm font-semibold text-on-surface-variant">Simple and secure</span>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    "Arrive at the hub",
                    "Show your code",
                    activeRequest.status === "completed" ? "Pickup complete" : "Confirm and collect"
                  ].map((title, index) => (
                    <div key={title} className="rounded-[1.5rem] bg-surface-container-low p-5">
                      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                        {index + 1}
                      </div>
                      <div className="mb-2 font-semibold text-on-surface">{title}</div>
                      <div className="text-sm text-on-surface-variant">
                        {index === 0
                          ? `Head to ${activeRequest.pickupLocation}.`
                          : index === 1
                            ? "Share the collection code only when you are with the assigned agent."
                            : activeRequest.status === "completed"
                              ? "This payout has already been settled."
                              : "Check the amount, collect your cash, and mark the pickup complete."}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <aside className="space-y-8 lg:col-span-4">
              <section className="page-card p-6 md:p-8">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="font-display text-headline-md text-on-surface">Pickup Status</h2>
                  <span className="status-live inline-flex">Live</span>
                </div>

                <div className="relative">
                  <div className="absolute left-4 top-2 h-[calc(100%-1rem)] w-[2px] bg-surface-container-highest" />
                  <div className="space-y-8">
                    {pickupTimeline.map((step) => (
                      <div key={step.title} className={`relative pl-12 ${step.future ? "opacity-45" : ""}`}>
                        <div
                          className={`absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full ${
                            step.done ? "bg-primary" : step.active ? "border-2 border-primary bg-white" : "bg-surface-container-highest"
                          }`}
                        >
                          {step.done ? <Icon name="check" filled className="text-[16px] text-white" /> : null}
                          {step.active ? <div className="h-3 w-3 rounded-full bg-primary" /> : null}
                        </div>
                        <div>
                          <div className={`font-semibold ${step.active ? "text-primary" : "text-on-surface"}`}>{step.title}</div>
                          <div className={`mt-1 text-sm ${step.active ? "text-primary" : "text-on-surface-variant"}`}>{step.time}</div>
                          {step.copy ? <div className="mt-2 text-sm text-on-surface-variant">{step.copy}</div> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="page-card p-6 md:p-8">
                <div className="mb-6">
                  <h2 className="font-display text-headline-md text-on-surface">Need help?</h2>
                  <p className="mt-2 text-body-md text-on-surface-variant">Reach the assigned agent or CashNode support if anything changes.</p>
                </div>

                <div className="space-y-3">
                  <a
                    href={`https://wa.me/2348001110000?text=${encodeURIComponent(`Hello CashNode support, I need help with pickup ${activeRequest.reference}.`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-full items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-4 text-left transition-colors hover:bg-stone-50"
                  >
                    <span className="flex items-center gap-3">
                      <Icon name="support_agent" className="text-primary" />
                      <span className="font-semibold text-on-surface">Message support</span>
                    </span>
                    <Icon name="chevron_right" className="text-stone-400" />
                  </a>

                  <a
                    href="tel:+2348001110000"
                    className="flex w-full items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-4 text-left transition-colors hover:bg-stone-50"
                  >
                    <span className="flex items-center gap-3">
                      <Icon name="call" className="text-primary" />
                      <span className="font-semibold text-on-surface">Call support</span>
                    </span>
                    <Icon name="chevron_right" className="text-stone-400" />
                  </a>
                </div>
              </section>
            </aside>
          </div>

          {activeRequest.status !== "completed" ? (
            <form action={completePickupAction} className="mt-8">
              <input type="hidden" name="requestId" value={activeRequest.id} />
              <button type="submit" className="w-full rounded-full bg-primary px-6 py-5 text-lg font-semibold text-white shadow-md">
                I&apos;ve Received the Cash
              </button>
            </form>
          ) : (
            <div className="mt-8 rounded-2xl bg-primary/10 px-6 py-5 text-center text-sm font-semibold text-primary">
              This payout has already been completed.
            </div>
          )}
        </>
      ) : (
        <div className="page-card p-8">
          <h1 className="font-display text-headline-lg text-on-surface">Receiver Portal</h1>
          <p className="mt-3 text-body-lg text-on-surface-variant">
            No pickup request is linked to this phone number yet. Once a sender creates one, the details will appear here.
          </p>
        </div>
      )}
    </AppShell>
  );
}
