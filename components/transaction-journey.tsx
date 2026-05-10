import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { PayoutRequestRecord } from "@/lib/payout-requests";

type JourneyAudience = "sender" | "receiver" | "agent";

type TransactionJourneyProps = {
  request: PayoutRequestRecord;
  audience: JourneyAudience;
  showSettlement?: boolean;
  supportHref?: string;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "Pending";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatUsdt(value: number) {
  return `${value.toFixed(2)} USDT`;
}

function formatNgn(value: number) {
  return `NGN ${value.toLocaleString("en-NG")}`;
}

function getSettlementLabel(request: PayoutRequestRecord) {
  switch (request.settlement?.status) {
    case "available_for_withdrawal":
      return "Available for withdrawal";
    case "withdrawal_requested":
      return "Queued for manual payout";
    case "transfer_pending":
      return "Transfer in progress";
    case "transfer_success":
      return "Transfer sent";
    case "transfer_failed":
      return request.settlement.failureReason || "Transfer failed";
    default:
      return "Pending completion";
  }
}

function getAudienceSummary(request: PayoutRequestRecord, audience: JourneyAudience) {
  if (audience === "sender") {
    return "You funded this payout. Receiver cash and agent payout handling stay visible from one timeline.";
  }

  if (audience === "agent") {
    return "This request shows what the sender paid, what the receiver should collect, and how your reimbursement progresses.";
  }

  return "Your pickup stays tied to a verified agent, a confirmed cash amount, and a single collection code.";
}

function getSenderPaidLabel(audience: JourneyAudience) {
  return audience === "sender" ? "You pay" : "Sender paid";
}

function buildJourneySteps(request: PayoutRequestRecord) {
  return [
    {
      title: "Sender funded",
      time: formatDateTime(request.createdAt),
      copy: `CashNode locked ${formatUsdt(request.totalToken)} for this payout.`,
      done: true,
      active: false
    },
    {
      title: "Agent accepted",
      time: request.assignedAgent ? formatDateTime(request.assignedAgent.acceptedAt) : "Waiting for assignment",
      copy: request.assignedAgent
        ? `${request.assignedAgent.name} is handling the handoff at ${request.pickupArea}.`
        : "A nearby verified agent will accept this request.",
      done: Boolean(request.assignedAgent),
      active: request.status === "open"
    },
    {
      title: "Receiver verified",
      time: request.status === "open" ? "Waiting for agent" : request.pickupLocation,
      copy:
        request.status === "open"
          ? "Pickup instructions unlock after the agent accepts the request."
          : `Receiver should present code ${request.collectionCode} only at the pickup point.`,
      done: request.status === "completed",
      active: request.status === "accepted"
    },
    {
      title: "Cash paid out",
      time: request.completedAt ? formatDateTime(request.completedAt) : request.cancelledAt ? formatDateTime(request.cancelledAt) : "Waiting for confirmation",
      copy:
        request.status === "completed"
          ? `${formatNgn(request.estimatedLocalAmount)} was confirmed for pickup.`
          : request.status === "cancelled"
            ? "This request was cancelled before cash collection."
            : "Cash handoff will be marked complete after receiver confirmation.",
      done: request.status === "completed",
      active: request.status === "accepted",
      future: request.status !== "completed" && request.status !== "cancelled"
    },
    {
      title: "Agent settlement",
      time:
        request.settlement?.completedAt
          ? formatDateTime(request.settlement.completedAt)
          : request.settlement?.initiatedAt
            ? formatDateTime(request.settlement.initiatedAt)
            : "Starts after completion",
      copy: getSettlementLabel(request),
      done: request.settlement?.status === "transfer_success",
      active:
        request.status === "completed" &&
        request.settlement?.status !== "transfer_success" &&
        request.settlement?.status !== "transfer_failed",
      future: request.status !== "completed"
    }
  ];
}

export function TransactionJourney({
  request,
  audience,
  showSettlement = true,
  supportHref = "/support"
}: TransactionJourneyProps) {
  const steps = buildJourneySteps(request).filter((step) => showSettlement || step.title !== "Agent settlement");
  const senderPaidLabel = getSenderPaidLabel(audience);

  return (
    <div className="space-y-6">
      <section className="page-card p-6 md:p-8">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-sm font-semibold text-primary">Live request story</div>
            <h2 className="font-display text-headline-md text-on-surface">Track the whole payout without switching mental context</h2>
            <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">{getAudienceSummary(request, audience)}</p>
          </div>
          <div className="rounded-2xl bg-surface-container-low px-4 py-3 text-right">
            <div className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">Reference</div>
            <div className="mt-1 font-semibold text-on-surface">{request.reference}</div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-primary px-5 py-5 text-white shadow-ambient">
            <div className="text-xs uppercase tracking-[0.2em] text-white/70">{senderPaidLabel}</div>
            <div className="mt-2 font-display text-[2rem] font-bold tracking-[-0.03em]">{formatUsdt(request.totalToken)}</div>
            <div className="mt-2 text-sm text-white/75">Includes sender fees and processing costs.</div>
          </div>

          <div className="rounded-2xl bg-secondary-container/50 px-5 py-5 text-on-surface">
            <div className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Receiver gets</div>
            <div className="mt-2 font-display text-[2rem] font-bold tracking-[-0.03em] text-primary">{formatNgn(request.estimatedLocalAmount)}</div>
            <div className="mt-2 text-sm text-on-surface-variant">Cash amount confirmed at the pickup point.</div>
          </div>

          <div className="rounded-2xl bg-surface-container-low px-5 py-5 text-on-surface">
            <div className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Agent earns</div>
            <div className="mt-2 font-display text-[2rem] font-bold tracking-[-0.03em]">{formatUsdt(request.agentFeeToken)}</div>
            <div className="mt-2 text-sm text-on-surface-variant">
              Settlement status: <span className="font-semibold text-on-surface">{getSettlementLabel(request)}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="page-card p-6 md:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-headline-md text-on-surface">Request progress</h2>
            <p className="mt-2 text-sm text-on-surface-variant">One timeline shared by sender, receiver, and agent.</p>
          </div>
          <span className="rounded-full bg-surface-container-low px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
            Live status
          </span>
        </div>

        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={step.title} className="grid gap-4 md:grid-cols-[56px_minmax(0,1fr)_180px] md:items-start">
              <div className="flex items-start justify-center pt-1">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-full border text-sm font-semibold ${
                    step.done
                      ? "border-primary bg-primary text-white"
                      : step.active
                        ? "border-primary/25 bg-primary/10 text-primary"
                        : step.future
                          ? "border-outline-variant bg-white text-on-surface-variant"
                          : "border-outline-variant bg-surface-container-low text-on-surface"
                  }`}
                >
                  {step.done ? <Icon name="check" className="text-[18px]" /> : index + 1}
                </div>
              </div>

              <div className="rounded-2xl bg-surface-container-low px-5 py-4">
                <div className="font-semibold text-on-surface">{step.title}</div>
                <div className="mt-2 text-sm text-on-surface-variant">{step.copy}</div>
              </div>

              <div className="text-sm font-semibold text-on-surface-variant md:pt-4">{step.time}</div>
            </div>
          ))}
        </div>
      </section>

      <section className={`grid gap-6 ${showSettlement ? "lg:grid-cols-2" : ""}`}>
        <div className="page-card p-6 md:p-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-headline-md text-on-surface">Pickup trust panel</h2>
              <p className="mt-2 text-sm text-on-surface-variant">The real-world handoff should feel verified, guided, and safe.</p>
            </div>
            <span className="status-success inline-flex">Verified flow</span>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl bg-surface-container-low px-5 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">Assigned agent</div>
              <div className="mt-2 text-lg font-semibold text-on-surface">{request.assignedAgent?.name ?? "Awaiting assignment"}</div>
              <div className="mt-1 text-sm text-on-surface-variant">
                {request.assignedAgent
                  ? `Verified agent with ${request.assignedAgent.rating} rating and ${request.assignedAgent.transferCount} completed handoffs.`
                  : "An approved CashNode agent will appear here once the request is accepted."}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">Pickup area</div>
                <div className="mt-2 font-semibold text-on-surface">{request.pickupArea}</div>
                <div className="mt-1 text-sm text-on-surface-variant">{request.pickupLocation}</div>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">Expected cash</div>
                <div className="mt-2 font-semibold text-primary">{formatNgn(request.estimatedLocalAmount)}</div>
                <div className="mt-1 text-sm text-on-surface-variant">Do not accept a different amount at pickup.</div>
              </div>
            </div>

            <div className="rounded-2xl border border-primary/10 bg-primary/5 px-5 py-4">
              <div className="text-sm font-semibold text-on-surface">Need help during pickup?</div>
              <div className="mt-2 text-sm text-on-surface-variant">
                If the agent is delayed or the handoff looks wrong, use the support route immediately before releasing or collecting cash.
              </div>
              <Link href={supportHref} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 font-semibold text-primary shadow-sm">
                Contact support
                <Icon name="chevron_right" className="text-[18px]" />
              </Link>
            </div>
          </div>
        </div>

        {showSettlement ? (
          <div className="page-card p-6 md:p-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-headline-md text-on-surface">Settlement confidence</h2>
                <p className="mt-2 text-sm text-on-surface-variant">Provider limitations should feel handled, not hidden.</p>
              </div>
              <span className="rounded-full bg-surface-container-low px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                Agent reimbursement
              </span>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl bg-surface-container-low px-5 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">Current status</div>
                <div className="mt-2 text-lg font-semibold text-on-surface">{getSettlementLabel(request)}</div>
                <div className="mt-1 text-sm text-on-surface-variant">
                  {request.settlement?.status === "withdrawal_requested"
                    ? "Your reimbursement is safe and has been queued while manual settlement is processed."
                    : request.settlement?.status === "transfer_failed"
                      ? "Settlement needs attention before transfer can be completed."
                      : "Settlement tracking stays attached to this request through completion."}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">Settlement amount</div>
                  <div className="mt-2 font-semibold text-on-surface">{formatNgn(request.settlement?.amountNgn ?? 0)}</div>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">Last update</div>
                  <div className="mt-2 font-semibold text-on-surface">{formatDateTime(request.settlement?.lastCheckedAt ?? request.updatedAt)}</div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {request.status === "completed" ? (
        <section className="page-card overflow-hidden p-6 md:p-8">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-primary">Completion proof</div>
              <h2 className="font-display text-headline-md text-on-surface">Settlement receipt</h2>
              <p className="mt-2 text-sm text-on-surface-variant">A complete summary for the demo and for post-payout confidence.</p>
            </div>
            <span className="status-success inline-flex">Completed</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl bg-surface-container-low px-5 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">Amount paid</div>
              <div className="mt-2 text-lg font-semibold text-on-surface">{formatUsdt(request.totalToken)}</div>
            </div>
            <div className="rounded-2xl bg-surface-container-low px-5 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">Receiver got</div>
              <div className="mt-2 text-lg font-semibold text-primary">{formatNgn(request.estimatedLocalAmount)}</div>
            </div>
            <div className="rounded-2xl bg-surface-container-low px-5 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">Agent</div>
              <div className="mt-2 text-lg font-semibold text-on-surface">{request.assignedAgent?.name ?? "CashNode agent"}</div>
            </div>
            <div className="rounded-2xl bg-surface-container-low px-5 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">Pickup area</div>
              <div className="mt-2 text-lg font-semibold text-on-surface">{request.pickupArea}</div>
            </div>
            <div className="rounded-2xl bg-surface-container-low px-5 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">Completed at</div>
              <div className="mt-2 text-lg font-semibold text-on-surface">{formatDateTime(request.completedAt)}</div>
            </div>
            <div className="rounded-2xl bg-surface-container-low px-5 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">Reference</div>
              <div className="mt-2 text-lg font-semibold text-on-surface">{request.reference}</div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}