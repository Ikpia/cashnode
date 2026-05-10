import { ObjectId, type Collection, type WithId } from "mongodb";
import { getFreshOnlineAgentPresenceByUserId, listFreshOnlineAgentPresenceMap } from "@/lib/agent-presence";
import { createBitnobUsdtNgnQuote, executeBitnobUsdtNgnPayout } from "@/lib/bitnob";
import { getMongoDb } from "@/lib/mongodb";
import {
  createPaystackTransferRecipient,
  getAutomaticSettlementUnavailableReason,
  initiatePaystackTransfer,
  verifyPaystackTransfer
} from "@/lib/paystack";
import {
  buildPickupDirectionsUrl,
  buildPickupMapEmbedUrl,
  calculateDistanceKm,
  findPickupLocation,
  formatDistanceLabel,
  formatPickupCoordinates,
  resolvePickupLocation
} from "@/lib/pickup-locations";
import {
  getUserById,
  getUserByPhoneAndRole,
  listActiveAgentUsers,
  type AppUser,
  updateAgentSettlementRecipientCode
} from "@/lib/users";

export type PayoutRequestStatus = "open" | "accepted" | "completed" | "cancelled";
export type StableToken = "USDT";
export type SettlementStatus =
  | "not_started"
  | "available_for_withdrawal"
  | "withdrawal_requested"
  | "recipient_created"
  | "transfer_pending"
  | "transfer_success"
  | "transfer_failed";
type SettlementProvider = "paystack" | "manual";

type ConversionQuoteDocument = {
  provider: "bitnob";
  status: "quoted" | "initialized" | "processing" | "success" | "failed" | "expired";
  quoteId: string;
  payoutId?: string | null;
  reference: string;
  rate: number;
  settlementAmountNgn: number;
  amountToken: number;
  feesToken: number;
  failureReason?: string;
  lastEventAt?: Date;
  expiresAt: Date;
  createdAt: Date;
};

type SettlementDocument = {
  provider: SettlementProvider;
  status: SettlementStatus;
  recipientCode?: string;
  transferCode?: string;
  transferReference?: string;
  amountNgn: number;
  currency: "NGN";
  reason: string;
  initiatedAt: Date;
  lastCheckedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  failureReason?: string;
};

type EscrowDocument = {
  provider: "solana";
  cluster: string;
  programId: string;
  status: "pending_signature" | "funded" | "accepted" | "paid" | "completed" | "cancelled" | "failed";
  escrowAddress: string;
  referenceSeed: string;
  senderWallet: string;
  agentWallet?: string | null;
  amountTokenUnits: number;
  agentFeeTokenUnits: number;
  platformFeeTokenUnits?: number;
  createSignature?: string;
  acceptSignature?: string;
  markPaidSignature?: string;
  completeSignature?: string;
  cancelSignature?: string;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
};

type LegacyEscrowDocument = EscrowDocument & {
  amountLamports?: number;
  agentFeeLamports?: number;
  platformFeeLamports?: number;
};

const VALID_ESCROW_TRANSITIONS: Record<
  "create" | "accept" | "mark_paid" | "complete" | "cancel",
  EscrowDocument["status"][]
> = {
  create: ["pending_signature"],
  accept: ["funded"],
  mark_paid: ["accepted"],
  complete: ["accepted", "paid"],
  cancel: ["pending_signature", "funded"]
};

const ESCROW_ACTION_TARGET_STATUS: Record<
  "create" | "accept" | "mark_paid" | "complete" | "cancel",
  EscrowDocument["status"]
> = {
  create: "funded",
  accept: "accepted",
  mark_paid: "paid",
  complete: "completed",
  cancel: "cancelled"
};

const ESCROW_ACTION_SIGNATURE_FIELD = {
  create: "createSignature",
  accept: "acceptSignature",
  mark_paid: "markPaidSignature",
  complete: "completeSignature",
  cancel: "cancelSignature"
} as const;

type AgentAssignmentDocument = {
  userId: ObjectId;
  name: string;
  phoneNumber: string;
  rating: number;
  transferCount: number;
  acceptedAt: Date;
  distanceKm?: number;
  serviceLocationId?: string;
  serviceZone?: string;
  serviceAddress?: string;
  serviceLatitude?: number;
  serviceLongitude?: number;
  locationSource?: "live_presence" | "registered_hub";
};

type PayoutRequestDocument = {
  reference: string;
  senderUserId: ObjectId;
  senderName: string;
  senderPhone: string;
  receiverName: string;
  receiverPhone: string;
  receiverUserId?: ObjectId;
  pickupArea: string;
  pickupLocationDetail?: string;
  pickupLocation: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  notes: string;
  tokenType: StableToken;
  tokenAmount: number;
  estimatedLocalAmount: number;
  localCurrency: "NGN";
  platformFeeToken: number;
  agentFeeToken: number;
  totalToken: number;
  conversionQuote?: ConversionQuoteDocument;
  settlement?: SettlementDocument;
  escrow?: EscrowDocument;
  collectionCode: string;
  status: PayoutRequestStatus;
  assignedAgent?: AgentAssignmentDocument;
  agentMarkedPaidAt?: Date;
  excludedAgentUserIds?: ObjectId[];
  completedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type PayoutRequestRecord = {
  id: string;
  reference: string;
  senderUserId: string;
  senderName: string;
  senderPhone: string;
  receiverName: string;
  receiverPhone: string;
  receiverUserId: string | null;
  pickupArea: string;
  pickupLocationDetail: string | null;
  pickupLocation: string;
  pickupLatitude: number;
  pickupLongitude: number;
  pickupCoordinatesLabel: string;
  pickupDirectionsUrl: string;
  pickupMapEmbedUrl: string;
  receiverWhatsAppMessage: string;
  receiverWhatsAppUrl: string;
  notes: string;
  tokenType: StableToken;
  tokenAmount: number;
  platformFeeToken: number;
  agentFeeToken: number;
  totalToken: number;
  conversionQuote: {
    provider: "bitnob";
    status: "quoted" | "initialized" | "processing" | "success" | "failed" | "expired";
    quoteId: string;
    payoutId: string | null;
    reference: string;
    rate: number;
    settlementAmountNgn: number;
    amountToken: number;
    feesToken: number;
    failureReason: string | null;
    lastEventAt: string | null;
    expiresAt: string;
    createdAt: string;
  } | null;
  settlement: {
    provider: SettlementProvider;
    status: SettlementStatus;
    recipientCode: string | null;
    transferCode: string | null;
    transferReference: string | null;
    amountNgn: number;
    currency: "NGN";
    reason: string;
    initiatedAt: string;
    lastCheckedAt: string | null;
    completedAt: string | null;
    failedAt: string | null;
    failureReason: string | null;
  } | null;
  escrow: {
    provider: "solana";
    cluster: string;
    programId: string;
    status: "pending_signature" | "funded" | "accepted" | "paid" | "completed" | "cancelled" | "failed";
    escrowAddress: string;
    referenceSeed: string;
    senderWallet: string;
    agentWallet: string | null;
    amountTokenUnits: number;
    agentFeeTokenUnits: number;
    platformFeeTokenUnits: number | null;
    createSignature: string | null;
    acceptSignature: string | null;
    markPaidSignature: string | null;
    completeSignature: string | null;
    cancelSignature: string | null;
    failureReason: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  amountUsd: number;
  estimatedLocalAmount: number;
  localCurrency: "NGN";
  platformFeeUsd: number;
  agentFeeUsd: number;
  totalUsd: number;
  collectionCode: string;
  status: PayoutRequestStatus;
  assignedAgent: {
    userId: string;
    name: string;
    phoneNumber: string;
    rating: number;
    transferCount: number;
    acceptedAt: string;
    distanceKm: number | null;
    distanceLabel: string | null;
    serviceLocationId: string | null;
    serviceZone: string | null;
    serviceAddress: string | null;
    serviceLatitude: number | null;
    serviceLongitude: number | null;
    locationSource: "live_presence" | "registered_hub" | null;
  } | null;
  agentMarkedPaidAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NearestEligibleAgentPreview = {
  pickupArea: string;
  pickupLocation: string;
  estimatedLocalAmount: number;
  localCurrency: "NGN";
  nearestAgent: {
    userId: string;
    name: string;
    phoneNumber: string;
    rating: number;
    transferCount: number;
    distanceKm: number;
    distanceLabel: string;
    serviceZone: string | null;
  } | null;
};

const COLLECTION_NAME = "payout_requests";
const LOCAL_EXCHANGE_RATE = 1550;
let indexSetupPromise: Promise<void> | null = null;

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeFiniteNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function tokenToUsd(tokenAmount: number) {
  // MVP pricing assumption: 1 USDT ~= 1 USD
  return roundCurrency(tokenAmount);
}

function ensureObjectId(value: string, label = "id") {
  if (!ObjectId.isValid(value)) {
    throw new Error(`Invalid ${label}.`);
  }

  return new ObjectId(value);
}

function ensureRequiredText(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }

  return value.trim();
}

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhoneNumber(value: unknown) {
  const normalizedValue = ensureRequiredText(value, "Receiver phone").replace(/[\s()-]/g, "");

  if (!/^\+[1-9]\d{7,14}$/.test(normalizedValue)) {
    throw new Error("Use an international phone number in E.164 format, for example +2348000000000.");
  }

  return normalizedValue;
}

function ensureStatusTransition(currentStatus: PayoutRequestStatus, expectedStatus: PayoutRequestStatus) {
  if (currentStatus !== expectedStatus) {
    throw new Error(`This request is no longer ${expectedStatus}. Refresh and try again.`);
  }
}

function generateReference() {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `CN-${random}`;
}

function generateCollectionCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function ensureStableToken(value: unknown): StableToken {
  if (value === undefined || value === null || value === "") {
    return "USDT";
  }

  if (value !== "USDT") {
    throw new Error("Only USDT is supported in this MVP.");
  }

  return value;
}

function calculateAgentRating(transferCount: number) {
  return Math.min(4.99, Number((4.84 + Math.min(transferCount, 15) * 0.01).toFixed(2)));
}

function buildReceiverWhatsAppMessage(input: {
  reference: string;
  collectionCode: string;
  amountNgn: number;
  pickupLocation: string;
  assignedAgentName?: string;
  assignedAgentPhone?: string;
}) {
  const agentLine = input.assignedAgentName
    ? `Agent: ${input.assignedAgentName}${input.assignedAgentPhone ? ` (${input.assignedAgentPhone})` : ""}`
    : "Agent: awaiting assignment";

  return [
    `CashNode pickup update for ${input.reference}.`,
    `Amount: NGN ${input.amountNgn.toLocaleString("en-NG")}.`,
    `Pickup address: ${input.pickupLocation}.`,
    `${agentLine}.`,
    `Collection code: ${input.collectionCode}.`
  ].join(" ");
}

function buildPaystackReference(requestReference: string) {
  const base = requestReference.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  const suffix = Math.random().toString(36).slice(2, 8);
  const reference = `cashnode-${base}-${suffix}`;
  return reference.length > 50 ? reference.slice(0, 50) : reference.padEnd(16, "0");
}

function computeAgentSettlementAmountNgn(input: {
  tokenAmount: number;
  agentFeeToken: number;
  conversionQuote?: ConversionQuoteDocument;
  estimatedLocalAmount: number;
}) {
  const conversionRate = input.conversionQuote?.rate ?? LOCAL_EXCHANGE_RATE;
  const feeInNgn = Math.round(input.agentFeeToken * conversionRate);
  return input.estimatedLocalAmount + feeInNgn;
}

function buildSettlementBatchReference(agentUserId: string) {
  const base = `withdraw-${agentUserId}`.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  const suffix = Math.random().toString(36).slice(2, 8);
  const reference = `cashnode-${base}-${suffix}`;
  return reference.length > 50 ? reference.slice(0, 50) : reference.padEnd(16, "0");
}

const MANUAL_WITHDRAWAL_QUEUE_MESSAGE =
  "Automatic bank payout is unavailable right now. CashNode queued this withdrawal for manual processing.";

function isThirdPartyPayoutRestriction(message: string) {
  return message.toLowerCase().includes("third party payouts");
}

function shouldQueueManualWithdrawal(message: string) {
  const normalizedMessage = message.toLowerCase();

  return (
    isThirdPartyPayoutRestriction(message) ||
    normalizedMessage.includes("automatic bank payout") ||
    normalizedMessage.includes("paystack_secret_key")
  );
}

function resolveSettlementProvider(): SettlementProvider {
  return getAutomaticSettlementUnavailableReason() ? "manual" : "paystack";
}

function mapPaystackStatusToSettlementStatus(status: string): SettlementStatus {
  if (status === "success") {
    return "transfer_success";
  }

  if (status === "failed" || status === "reversed") {
    return "transfer_failed";
  }

  return "transfer_pending";
}

function mapBitnobEventToQuoteStatus(eventName: string) {
  const normalizedEvent = eventName.toLowerCase();

  if (normalizedEvent.includes("completed") || normalizedEvent.includes("success")) {
    return "success";
  }

  if (normalizedEvent.includes("pending") || normalizedEvent.includes("processing")) {
    return "processing";
  }

  if (normalizedEvent.includes("initiated") || normalizedEvent.includes("initialized")) {
    return "initialized";
  }

  if (normalizedEvent.includes("expired")) {
    return "expired";
  }

  if (normalizedEvent.includes("failed")) {
    return "failed";
  }

  return "quoted";
}

function ensureAgentDispatchProfile(agentUser: AppUser) {
  if (!agentUser.agentProfile) {
    throw new Error("This agent is not fully configured for live dispatch yet.");
  }

  return agentUser.agentProfile;
}

function ensureAgentOperationalEligibility(input: { agentUser: AppUser; requestAmountNgn: number }) {
  const agentProfile = ensureAgentDispatchProfile(input.agentUser);

  if (agentProfile.manualReviewRequired) {
    throw new Error("This agent is under manual review and cannot accept new requests yet.");
  }

  if (input.requestAmountNgn > agentProfile.maxSinglePayoutNgn) {
    throw new Error("This payout exceeds the agent's single-request limit.");
  }

  return agentProfile;
}

function ensureAgentBankSettlementProfile(agentUser: AppUser) {
  const agentProfile = ensureAgentDispatchProfile(agentUser);
  const bankCode = agentProfile.settlementBankCode?.trim() ?? "";
  const accountNumber = agentProfile.settlementAccountNumber?.trim() ?? "";
  const accountName = agentProfile.settlementAccountName?.trim() ?? "";

  if (!bankCode || !accountNumber || !accountName) {
    throw new Error("Agent settlement account is incomplete. Add settlement bank, account number, and account name in agent onboarding.");
  }

  return {
    bankCode,
    accountNumber,
    accountName,
    recipientCode: agentProfile.paystackRecipientCode?.trim() || null
  };
}

function buildAssignedAgentSnapshot(input: {
  agentUser: AppUser;
  acceptedAt: Date;
  distanceKm: number;
  transferCount: number;
  locationSource: "live_presence" | "registered_hub";
}): AgentAssignmentDocument {
  const agentProfile = ensureAgentDispatchProfile(input.agentUser);

  return {
    userId: ensureObjectId(input.agentUser.id, "agent user id"),
    name: agentProfile.businessName || input.agentUser.displayName || "CashNode Agent",
    phoneNumber: input.agentUser.phoneNumber,
    rating: calculateAgentRating(input.transferCount),
    transferCount: input.transferCount,
    acceptedAt: input.acceptedAt,
    distanceKm: roundCurrency(input.distanceKm),
    serviceLocationId: agentProfile.serviceLocationId,
    serviceZone: agentProfile.serviceZone,
    serviceAddress: agentProfile.serviceAddress,
    serviceLatitude: agentProfile.serviceLatitude,
    serviceLongitude: agentProfile.serviceLongitude,
    locationSource: input.locationSource
  };
}

function ensureCoordinates(latitude?: number | null, longitude?: number | null) {
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    throw new Error("Agent coordinates are missing.");
  }

  return {
    latitude,
    longitude
  };
}

function getAgentReferenceCoordinates(input: {
  agentUser: AppUser;
  livePresence?: {
    latitude: number | null;
    longitude: number | null;
  } | null;
}) {
  const agentProfile = ensureAgentDispatchProfile(input.agentUser);
  const liveLatitude = input.livePresence?.latitude;
  const liveLongitude = input.livePresence?.longitude;

  if (typeof liveLatitude === "number" && typeof liveLongitude === "number") {
    return {
      latitude: liveLatitude,
      longitude: liveLongitude,
      source: "live_presence" as const
    };
  }

  return {
    latitude: agentProfile.serviceLatitude,
    longitude: agentProfile.serviceLongitude,
    source: "registered_hub" as const
  };
}

function serializePayoutRequest(document: WithId<PayoutRequestDocument>): PayoutRequestRecord {
  const legacyDocument = document as unknown as {
    amountUsd?: unknown;
    platformFeeUsd?: unknown;
    agentFeeUsd?: unknown;
    totalUsd?: unknown;
  };
  const tokenAmount = roundCurrency(normalizeFiniteNumber(document.tokenAmount, normalizeFiniteNumber(legacyDocument.amountUsd, 0)));
  const platformFeeToken = roundCurrency(
    normalizeFiniteNumber(document.platformFeeToken, normalizeFiniteNumber(legacyDocument.platformFeeUsd, 0))
  );
  const agentFeeToken = roundCurrency(
    normalizeFiniteNumber(document.agentFeeToken, normalizeFiniteNumber(legacyDocument.agentFeeUsd, 0))
  );
  const totalToken = roundCurrency(
    normalizeFiniteNumber(
      document.totalToken,
      normalizeFiniteNumber(legacyDocument.totalUsd, tokenAmount + platformFeeToken + agentFeeToken)
    )
  );
  const senderSelectedLocation = resolvePickupLocation(document.pickupArea || document.pickupLocation);

  // Re-derive the agent's hub from the canonical pickup-locations list using their
  // serviceLocationId so we always use up-to-date coordinates and area labels —
  // the snapshot stored at assignment time may be stale if the agent re-onboarded.
  const agentRegisteredHub =
    document.assignedAgent?.serviceLocationId
      ? findPickupLocation(document.assignedAgent.serviceLocationId)
      : null;

  const assignedAgentPickup =
    document.assignedAgent &&
    document.status !== "open" &&
    document.status !== "cancelled" &&
    (agentRegisteredHub ||
      (typeof document.assignedAgent.serviceLatitude === "number" &&
        typeof document.assignedAgent.serviceLongitude === "number" &&
        document.assignedAgent.serviceAddress))
      ? {
          // Prefer the live hub label; fall back to snapshot zone
          area: agentRegisteredHub?.area || document.assignedAgent.serviceZone || document.pickupArea || senderSelectedLocation.area,
          // Keep the agent's stored address (includes their serviceLocationDetail like "OG HUB, near …")
          address: document.assignedAgent.serviceAddress || agentRegisteredHub?.address || senderSelectedLocation.address,
          // Use canonical coordinates — authoritative and always accurate
          latitude: agentRegisteredHub?.latitude ?? (document.assignedAgent.serviceLatitude as number),
          longitude: agentRegisteredHub?.longitude ?? (document.assignedAgent.serviceLongitude as number)
        }
      : null;
  const pickupLatitude = assignedAgentPickup?.latitude ?? document.pickupLatitude ?? senderSelectedLocation.latitude;
  const pickupLongitude = assignedAgentPickup?.longitude ?? document.pickupLongitude ?? senderSelectedLocation.longitude;
  const pickupArea = assignedAgentPickup?.area ?? senderSelectedLocation.area;
  const pickupLocation = assignedAgentPickup?.address ?? senderSelectedLocation.address;
  const pickupLocationDetail = normalizeOptionalText(document.pickupLocationDetail);
  const displayPickupArea = !assignedAgentPickup && pickupLocationDetail ? `${pickupArea} - ${pickupLocationDetail}` : pickupArea;
  const displayPickupLocation =
    !assignedAgentPickup && pickupLocationDetail ? `${pickupLocation} (${pickupLocationDetail})` : pickupLocation;
  const pickupLocationForDirections = {
    id: agentRegisteredHub?.id || (assignedAgentPickup ? document.assignedAgent?.serviceLocationId || senderSelectedLocation.id : senderSelectedLocation.id),
    state: agentRegisteredHub?.state || senderSelectedLocation.state,
    city: agentRegisteredHub?.city || senderSelectedLocation.city,
    aliases: agentRegisteredHub?.aliases || senderSelectedLocation.aliases,
    area: pickupArea,
    address: pickupLocation,
    latitude: pickupLatitude,
    longitude: pickupLongitude
  };
  const receiverWhatsAppMessage = buildReceiverWhatsAppMessage({
    reference: document.reference,
    collectionCode: document.collectionCode,
    amountNgn: document.estimatedLocalAmount,
    pickupLocation,
    assignedAgentName: document.assignedAgent?.name,
    assignedAgentPhone: document.assignedAgent?.phoneNumber
  });
  const receiverWhatsAppPhone = document.receiverPhone.replace(/\D/g, "");
  const receiverWhatsAppUrl = `https://wa.me/${receiverWhatsAppPhone}?text=${encodeURIComponent(receiverWhatsAppMessage)}`;

  return {
    id: document._id.toHexString(),
    reference: document.reference,
    senderUserId: document.senderUserId.toHexString(),
    senderName: document.senderName,
    senderPhone: document.senderPhone,
    receiverName: document.receiverName,
    receiverPhone: document.receiverPhone,
    receiverUserId: document.receiverUserId?.toHexString() ?? null,
    pickupArea: displayPickupArea,
    pickupLocationDetail: pickupLocationDetail || null,
    pickupLocation: displayPickupLocation,
    pickupLatitude,
    pickupLongitude,
    pickupCoordinatesLabel: formatPickupCoordinates(pickupLatitude, pickupLongitude),
    pickupDirectionsUrl: buildPickupDirectionsUrl({
      ...pickupLocationForDirections,
      latitude: pickupLatitude,
      longitude: pickupLongitude
    }),
    pickupMapEmbedUrl: buildPickupMapEmbedUrl({
      latitude: pickupLatitude,
      longitude: pickupLongitude
    }),
    receiverWhatsAppMessage,
    receiverWhatsAppUrl,
    notes: document.notes,
    tokenType: ensureStableToken(document.tokenType),
    tokenAmount,
    platformFeeToken,
    agentFeeToken,
    totalToken,
    conversionQuote: document.conversionQuote
      ? {
          provider: "bitnob",
          status: document.conversionQuote.status,
          quoteId: document.conversionQuote.quoteId,
          payoutId: document.conversionQuote.payoutId ?? null,
          reference: document.conversionQuote.reference,
          rate: document.conversionQuote.rate,
          settlementAmountNgn: document.conversionQuote.settlementAmountNgn,
          amountToken: document.conversionQuote.amountToken,
          feesToken: document.conversionQuote.feesToken,
          failureReason: document.conversionQuote.failureReason ?? null,
          lastEventAt: document.conversionQuote.lastEventAt?.toISOString() ?? null,
          expiresAt: document.conversionQuote.expiresAt.toISOString(),
          createdAt: document.conversionQuote.createdAt.toISOString()
        }
      : null,
    settlement: document.settlement
      ? {
          provider: document.settlement.provider,
          status: document.settlement.status,
          recipientCode: document.settlement.recipientCode ?? null,
          transferCode: document.settlement.transferCode ?? null,
          transferReference: document.settlement.transferReference ?? null,
          amountNgn: document.settlement.amountNgn,
          currency: "NGN",
          reason: document.settlement.reason,
          initiatedAt: document.settlement.initiatedAt.toISOString(),
          lastCheckedAt: document.settlement.lastCheckedAt?.toISOString() ?? null,
          completedAt: document.settlement.completedAt?.toISOString() ?? null,
          failedAt: document.settlement.failedAt?.toISOString() ?? null,
          failureReason: document.settlement.failureReason ?? null
        }
      : null,
    escrow: document.escrow
      ? (() => {
          const escrow = document.escrow as LegacyEscrowDocument;

          return {
            provider: escrow.provider,
            cluster: escrow.cluster,
            programId: escrow.programId,
            status: escrow.status,
            escrowAddress: escrow.escrowAddress,
            referenceSeed: escrow.referenceSeed,
            senderWallet: escrow.senderWallet,
            agentWallet: escrow.agentWallet ?? null,
            amountTokenUnits: escrow.amountTokenUnits ?? escrow.amountLamports ?? 0,
            agentFeeTokenUnits: escrow.agentFeeTokenUnits ?? escrow.agentFeeLamports ?? 0,
            platformFeeTokenUnits: escrow.platformFeeTokenUnits ?? escrow.platformFeeLamports ?? null,
            createSignature: escrow.createSignature ?? null,
            acceptSignature: escrow.acceptSignature ?? null,
            markPaidSignature: escrow.markPaidSignature ?? null,
            completeSignature: escrow.completeSignature ?? null,
            cancelSignature: escrow.cancelSignature ?? null,
            failureReason: escrow.failureReason ?? null,
            createdAt: escrow.createdAt.toISOString(),
            updatedAt: escrow.updatedAt.toISOString()
          };
        })()
      : null,
    amountUsd: tokenToUsd(tokenAmount),
    estimatedLocalAmount: document.estimatedLocalAmount,
    localCurrency: document.localCurrency,
    platformFeeUsd: tokenToUsd(platformFeeToken),
    agentFeeUsd: tokenToUsd(agentFeeToken),
    totalUsd: tokenToUsd(totalToken),
    collectionCode: document.collectionCode,
    status: document.status,
    assignedAgent: document.assignedAgent
      ? {
          userId: document.assignedAgent.userId.toHexString(),
          name: document.assignedAgent.name,
          phoneNumber: document.assignedAgent.phoneNumber,
          rating: document.assignedAgent.rating,
          transferCount: document.assignedAgent.transferCount,
          acceptedAt: document.assignedAgent.acceptedAt.toISOString(),
          distanceKm: document.assignedAgent.distanceKm ?? null,
          distanceLabel:
            typeof document.assignedAgent.distanceKm === "number" ? formatDistanceLabel(document.assignedAgent.distanceKm) : null,
          serviceLocationId: document.assignedAgent.serviceLocationId ?? null,
          serviceZone: document.assignedAgent.serviceZone ?? null,
          serviceAddress: document.assignedAgent.serviceAddress ?? null,
          serviceLatitude:
            typeof document.assignedAgent.serviceLatitude === "number" ? document.assignedAgent.serviceLatitude : null,
          serviceLongitude:
            typeof document.assignedAgent.serviceLongitude === "number" ? document.assignedAgent.serviceLongitude : null,
          locationSource: document.assignedAgent.locationSource ?? null
        }
      : null,
    agentMarkedPaidAt: document.agentMarkedPaidAt?.toISOString() ?? null,
    completedAt: document.completedAt?.toISOString() ?? null,
    cancelledAt: document.cancelledAt?.toISOString() ?? null,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString()
  };
}

async function getPayoutRequestsCollection(): Promise<Collection<PayoutRequestDocument>> {
  const db = await getMongoDb();
  const collection = db.collection<PayoutRequestDocument>(COLLECTION_NAME);

  if (!indexSetupPromise) {
    indexSetupPromise = collection
      .createIndexes([
        { key: { senderUserId: 1, updatedAt: -1 }, name: "sender_lookup" },
        { key: { status: 1, updatedAt: -1 }, name: "status_lookup" },
        { key: { receiverPhone: 1, updatedAt: -1 }, name: "receiver_lookup" },
        { key: { "assignedAgent.userId": 1, updatedAt: -1 }, name: "agent_lookup" }
      ])
      .then(() => undefined);
  }

  await indexSetupPromise;
  return collection;
}

async function getAgentRequestLoadStats(collection: Collection<PayoutRequestDocument>, agentUserIds: string[]) {
  if (agentUserIds.length === 0) {
    return {
      activeLoadByAgentId: new Map<string, number>(),
      completedCountByAgentId: new Map<string, number>()
    };
  }

  const agentObjectIds = agentUserIds.map((agentUserId) => ensureObjectId(agentUserId, "agent user id"));
  const documents = await collection
    .find({
      "assignedAgent.userId": { $in: agentObjectIds },
      status: { $in: ["accepted", "completed"] }
    })
    .project({
      status: 1,
      estimatedLocalAmount: 1,
      assignedAgent: 1
    })
    .toArray();

  const activeLoadByAgentId = new Map<string, number>();
  const completedCountByAgentId = new Map<string, number>();

  for (const document of documents) {
    const assignedAgentUserId = document.assignedAgent?.userId?.toHexString();

    if (!assignedAgentUserId) {
      continue;
    }

    if (document.status === "accepted") {
      const currentLoad = activeLoadByAgentId.get(assignedAgentUserId) ?? 0;
      activeLoadByAgentId.set(assignedAgentUserId, currentLoad + document.estimatedLocalAmount);
    }

    if (document.status === "completed") {
      const currentCount = completedCountByAgentId.get(assignedAgentUserId) ?? 0;
      completedCountByAgentId.set(assignedAgentUserId, currentCount + 1);
    }
  }

  return {
    activeLoadByAgentId,
    completedCountByAgentId
  };
}

async function findNearestEligibleAgent(input: {
  collection: Collection<PayoutRequestDocument>;
  pickupLatitude: number;
  pickupLongitude: number;
  estimatedLocalAmount: number;
  excludedAgentUserIds?: string[];
}) {
  const activeAgents = await listActiveAgentUsers();

  if (activeAgents.length === 0) {
    return null;
  }

  const excludedAgentUserIdSet = new Set((input.excludedAgentUserIds ?? []).filter(Boolean));

  const { activeLoadByAgentId, completedCountByAgentId } = await getAgentRequestLoadStats(
    input.collection,
    activeAgents.map((agent) => agent.id)
  );
  const livePresenceByAgentId = await listFreshOnlineAgentPresenceMap(activeAgents.map((agent) => agent.id));

  const eligibleAgents = activeAgents
    .flatMap((agentUser) => {
      if (excludedAgentUserIdSet.has(agentUser.id)) {
        return [];
      }

      if (!agentUser.agentProfile || agentUser.agentProfile.manualReviewRequired) {
        return [];
      }

      if (input.estimatedLocalAmount > agentUser.agentProfile.maxSinglePayoutNgn) {
        return [];
      }

      const livePresence = livePresenceByAgentId.get(agentUser.id);
      const referenceCoordinates = getAgentReferenceCoordinates({
        agentUser,
        livePresence:
          livePresence && typeof livePresence.latitude === "number" && typeof livePresence.longitude === "number"
            ? { latitude: livePresence.latitude, longitude: livePresence.longitude }
            : null
      });

      const activeLoadNgn = activeLoadByAgentId.get(agentUser.id) ?? 0;
      const remainingCapacityNgn = agentUser.agentProfile.dailyCapacityNgn - activeLoadNgn;

      if (remainingCapacityNgn < input.estimatedLocalAmount) {
        return [];
      }

      const distanceKm = calculateDistanceKm(
        ensureCoordinates(referenceCoordinates.latitude, referenceCoordinates.longitude),
        {
          latitude: input.pickupLatitude,
          longitude: input.pickupLongitude
        }
      );

      return [
        {
          agentUser,
          distanceKm,
          remainingCapacityNgn,
          transferCount: completedCountByAgentId.get(agentUser.id) ?? 0,
          locationSource: referenceCoordinates.source
        }
      ];
    })
    .sort((left, right) => {
      if (left.locationSource !== right.locationSource) {
        return left.locationSource === "live_presence" ? -1 : 1;
      }

      if (left.distanceKm !== right.distanceKm) {
        return left.distanceKm - right.distanceKm;
      }

      if (left.remainingCapacityNgn !== right.remainingCapacityNgn) {
        return right.remainingCapacityNgn - left.remainingCapacityNgn;
      }

      return new Date(right.agentUser.lastLoginAt).getTime() - new Date(left.agentUser.lastLoginAt).getTime();
    });

  return eligibleAgents[0] ?? null;
}

function getRequestPickupCoordinates(document: Pick<PayoutRequestDocument, "pickupArea" | "pickupLocation" | "pickupLatitude" | "pickupLongitude">) {
  const resolvedPickupLocation = resolvePickupLocation(document.pickupArea || document.pickupLocation);

  return {
    latitude: document.pickupLatitude ?? resolvedPickupLocation.latitude,
    longitude: document.pickupLongitude ?? resolvedPickupLocation.longitude
  };
}

async function autoAssignBestEligibleAgent(input: {
  collection: Collection<PayoutRequestDocument>;
  requestDocument: WithId<PayoutRequestDocument>;
  excludedAgentUserIds?: string[];
}) {
  const requestPickupCoordinates = getRequestPickupCoordinates(input.requestDocument);
  const nearestEligibleAgent = await findNearestEligibleAgent({
    collection: input.collection,
    pickupLatitude: requestPickupCoordinates.latitude,
    pickupLongitude: requestPickupCoordinates.longitude,
    estimatedLocalAmount: input.requestDocument.estimatedLocalAmount,
    excludedAgentUserIds: input.excludedAgentUserIds
  });
  const now = new Date();

  if (!nearestEligibleAgent) {
    await input.collection.updateOne(
      { _id: input.requestDocument._id },
      {
        $set: {
          status: "open",
          updatedAt: now
        },
        $unset: {
          assignedAgent: ""
        }
      }
    );
    const reopenedDocument = await input.collection.findOne({ _id: input.requestDocument._id });
    return reopenedDocument ?? input.requestDocument;
  }

  await input.collection.updateOne(
    { _id: input.requestDocument._id },
    {
      $set: {
        status: "accepted",
        assignedAgent: buildAssignedAgentSnapshot({
          agentUser: nearestEligibleAgent.agentUser,
          acceptedAt: now,
          distanceKm: nearestEligibleAgent.distanceKm,
          transferCount: nearestEligibleAgent.transferCount,
          locationSource: nearestEligibleAgent.locationSource
        }),
        updatedAt: now
      }
    }
  );

  const assignedDocument = await input.collection.findOne({ _id: input.requestDocument._id });
  return assignedDocument ?? input.requestDocument;
}

async function autoReassignAcceptedRequestIfNeeded(input: {
  collection: Collection<PayoutRequestDocument>;
  requestDocument: WithId<PayoutRequestDocument>;
}) {
  const document = input.requestDocument;

  if (document.status !== "accepted" || !document.assignedAgent?.userId) {
    return document;
  }

  const assignedAgentUserId = document.assignedAgent.userId.toHexString();
  const assignedAgentUser = await getUserById(assignedAgentUserId);
  const mustReassign =
    !assignedAgentUser ||
    !assignedAgentUser.agentProfile ||
    assignedAgentUser.agentProfile.manualReviewRequired ||
    !assignedAgentUser.agentProfile.isAvailable ||
    document.estimatedLocalAmount > assignedAgentUser.agentProfile.maxSinglePayoutNgn;

  if (!mustReassign) {
    return document;
  }

  // Do NOT add the agent to the exclusion list here — they were unassigned due to
  // profile/capacity reasons, not because they declined. Only declinePayoutRequest
  // should permanently exclude an agent from a request.
  const existingExcludedIds = (document.excludedAgentUserIds ?? []).map((agentId) => agentId.toHexString());
  const now = new Date();

  await input.collection.updateOne(
    { _id: document._id },
    {
      $set: {
        updatedAt: now
      }
    }
  );

  const updatedDocument = await input.collection.findOne({ _id: document._id });

  if (!updatedDocument) {
    return document;
  }

  return autoAssignBestEligibleAgent({
    collection: input.collection,
    requestDocument: updatedDocument,
    excludedAgentUserIds: existingExcludedIds
  });
}

export async function previewNearestEligibleAgentForPickup(input: {
  pickupArea: string;
  tokenAmount: number;
  tokenType?: StableToken;
}): Promise<NearestEligibleAgentPreview> {
  void ensureStableToken(input.tokenType);
  const collection = await getPayoutRequestsCollection();
  const pickupArea = ensureRequiredText(input.pickupArea, "Pickup area");
  const tokenAmount = Number(input.tokenAmount);
  const resolvedPickupLocation = findPickupLocation(pickupArea);

  if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) {
    throw new Error("Enter a valid USDT amount to preview the nearest eligible agent.");
  }

  if (!resolvedPickupLocation) {
    throw new Error("Select a valid pickup location.");
  }

  const estimatedLocalAmount = Math.round(tokenToUsd(tokenAmount) * LOCAL_EXCHANGE_RATE);
  const nearestEligibleAgent = await findNearestEligibleAgent({
    collection,
    pickupLatitude: resolvedPickupLocation.latitude,
    pickupLongitude: resolvedPickupLocation.longitude,
    estimatedLocalAmount
  });

  return {
    pickupArea: resolvedPickupLocation.area,
    pickupLocation: resolvedPickupLocation.address,
    estimatedLocalAmount,
    localCurrency: "NGN",
    nearestAgent: nearestEligibleAgent
      ? {
          userId: nearestEligibleAgent.agentUser.id,
          name: nearestEligibleAgent.agentUser.agentProfile?.businessName || nearestEligibleAgent.agentUser.displayName || "CashNode Agent",
          phoneNumber: nearestEligibleAgent.agentUser.phoneNumber,
          rating: calculateAgentRating(nearestEligibleAgent.transferCount),
          transferCount: nearestEligibleAgent.transferCount,
          distanceKm: roundCurrency(nearestEligibleAgent.distanceKm),
          distanceLabel: formatDistanceLabel(nearestEligibleAgent.distanceKm),
          serviceZone: nearestEligibleAgent.agentUser.agentProfile?.serviceZone ?? null
        }
      : null
  };
}

async function refreshSettlementStateIfPending(collection: Collection<PayoutRequestDocument>, document: WithId<PayoutRequestDocument>) {
  if (!document.settlement?.transferReference || document.settlement.status !== "transfer_pending") {
    return document;
  }

  try {
    const verification = await verifyPaystackTransfer(document.settlement.transferReference);
    const nextStatus = mapPaystackStatusToSettlementStatus(verification.status);
    const now = new Date();

    if (nextStatus !== document.settlement.status) {
      const setPayload: Record<string, unknown> = {
        "settlement.status": nextStatus,
        "settlement.transferCode": verification.transferCode ?? document.settlement.transferCode,
        "settlement.lastCheckedAt": now
      };

      if (nextStatus === "transfer_success") {
        setPayload["settlement.completedAt"] = now;
      }

      if (nextStatus === "transfer_failed") {
        setPayload["settlement.failedAt"] = now;
        setPayload["settlement.failureReason"] = `Paystack status: ${verification.status || "failed"}`;
      }

      await collection.updateOne(
        { _id: document._id },
        {
          $set: setPayload,
          ...(nextStatus === "transfer_success"
            ? {
                $unset: {
                  "settlement.failureReason": ""
                }
              }
            : {})
        }
      );

      const refreshed = await collection.findOne({ _id: document._id });
      return refreshed ?? document;
    }

    await collection.updateOne(
      { _id: document._id },
      {
        $set: {
          "settlement.lastCheckedAt": now
        }
      }
    );
  } catch (error) {
    const now = new Date();
    const failureReason = error instanceof Error ? error.message : "Failed to verify transfer status.";

    await collection.updateOne(
      { _id: document._id },
      {
        $set: {
          "settlement.lastCheckedAt": now,
          "settlement.failureReason": failureReason
        }
      }
    );
  }

  const latest = await collection.findOne({ _id: document._id });
  return latest ?? document;
}

async function refreshRequestSettlementStateOnly(collection: Collection<PayoutRequestDocument>, document: WithId<PayoutRequestDocument>) {
  return refreshSettlementStateIfPending(collection, document);
}

async function refreshRequestRuntimeState(collection: Collection<PayoutRequestDocument>, document: WithId<PayoutRequestDocument>) {
  const reassignedDocument = await autoReassignAcceptedRequestIfNeeded({
    collection,
    requestDocument: document
  });

  return refreshSettlementStateIfPending(collection, reassignedDocument);
}

async function executeAgentSettlement(input: {
  collection: Collection<PayoutRequestDocument>;
  requestDocument: WithId<PayoutRequestDocument>;
  agentUser: AppUser;
}) {
  const { bankCode, accountNumber, accountName, recipientCode: existingRecipientCode } = ensureAgentBankSettlementProfile(input.agentUser);
  const settlementAmountNgn = computeAgentSettlementAmountNgn({
    tokenAmount: input.requestDocument.tokenAmount,
    agentFeeToken: input.requestDocument.agentFeeToken,
    conversionQuote: input.requestDocument.conversionQuote,
    estimatedLocalAmount: input.requestDocument.estimatedLocalAmount
  });
  const reason = `CashNode payout ${input.requestDocument.reference}`;
  const now = new Date();

  let recipientCode = existingRecipientCode;

  if (!recipientCode) {
    const recipient = await createPaystackTransferRecipient({
      name: accountName,
      accountNumber,
      bankCode,
      description: `CashNode agent ${input.agentUser.displayName || input.agentUser.phoneNumber}`
    });
    recipientCode = recipient.recipientCode;
    await updateAgentSettlementRecipientCode({
      userId: input.agentUser.id,
      recipientCode
    });
  }

  await input.collection.updateOne(
    { _id: input.requestDocument._id },
    {
      $set: {
        settlement: {
          provider: "paystack",
          status: "recipient_created",
          recipientCode,
          amountNgn: settlementAmountNgn,
          currency: "NGN",
          reason,
          initiatedAt: now
        },
        updatedAt: now
      }
    }
  );

  const transferReference = buildPaystackReference(input.requestDocument.reference);

  try {
    const transfer = await initiatePaystackTransfer({
      recipientCode,
      amountNgn: settlementAmountNgn,
      reference: transferReference,
      reason
    });
    const nextStatus = mapPaystackStatusToSettlementStatus(transfer.status);
    const now = new Date();
    const setPayload: Record<string, unknown> = {
      "settlement.status": nextStatus,
      "settlement.transferReference": transfer.reference,
      "settlement.lastCheckedAt": now,
      updatedAt: now
    };

    if (transfer.transferCode) {
      setPayload["settlement.transferCode"] = transfer.transferCode;
    }

    if (nextStatus === "transfer_success") {
      setPayload["settlement.completedAt"] = now;
    }

    if (nextStatus === "transfer_failed") {
      setPayload["settlement.failedAt"] = now;
      setPayload["settlement.failureReason"] = "Paystack returned a failed status.";
    }

    await input.collection.updateOne(
      { _id: input.requestDocument._id },
      {
        $set: setPayload,
        ...(nextStatus === "transfer_success"
          ? {
              $unset: {
                "settlement.failureReason": ""
              }
            }
          : {})
      }
    );
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : "Unable to initiate Paystack transfer.";

    await input.collection.updateOne(
      { _id: input.requestDocument._id },
      {
        $set: {
          "settlement.status": "transfer_failed",
          "settlement.transferReference": transferReference,
          "settlement.lastCheckedAt": new Date(),
          "settlement.failedAt": new Date(),
          "settlement.failureReason": failureReason,
          updatedAt: new Date()
        }
      }
    );
  }
}

async function queueManualWithdrawalRequests(input: {
  collection: Collection<PayoutRequestDocument>;
  eligibleRequests: WithId<PayoutRequestDocument>[];
  transferReference: string;
  reason: string;
  recipientCode?: string | null;
}) {
  const queuedAt = new Date();
  const setPayload: Record<string, unknown> = {
    "settlement.provider": "manual",
    "settlement.status": "withdrawal_requested",
    "settlement.reason": input.reason,
    "settlement.initiatedAt": queuedAt,
    "settlement.transferReference": input.transferReference,
    "settlement.lastCheckedAt": queuedAt,
    "settlement.failureReason": MANUAL_WITHDRAWAL_QUEUE_MESSAGE,
    updatedAt: queuedAt
  };

  if (input.recipientCode) {
    setPayload["settlement.recipientCode"] = input.recipientCode;
  }

  await input.collection.updateMany(
    { _id: { $in: input.eligibleRequests.map((request) => request._id) } },
    {
      $set: setPayload,
      $unset: {
        "settlement.failedAt": "",
        "settlement.completedAt": "",
        "settlement.transferCode": ""
      }
    }
  );

  const queuedRequests = await input.collection
    .find({ _id: { $in: input.eligibleRequests.map((request) => request._id) } })
    .sort({ completedAt: 1, updatedAt: 1 })
    .toArray();

  return queuedRequests.map(serializePayoutRequest);
}

export async function withdrawAgentSettlements(input: { agentUser: AppUser }) {
  const collection = await getPayoutRequestsCollection();
  const agentObjectId = ensureObjectId(input.agentUser.id, "agent user id");
  const eligibleRequests = await collection
    .find({
      status: "completed",
      "assignedAgent.userId": agentObjectId,
      $or: [
        { "settlement.status": "available_for_withdrawal" },
        { "settlement.status": "transfer_failed" }
      ]
    })
    .sort({ completedAt: 1, updatedAt: 1 })
    .toArray();

  if (eligibleRequests.length === 0) {
    throw new Error("No completed payout balance is available to withdraw.");
  }

  const { bankCode, accountNumber, accountName, recipientCode: existingRecipientCode } = ensureAgentBankSettlementProfile(input.agentUser);
  const totalAmountNgn = eligibleRequests.reduce((sum, request) => sum + (request.settlement?.amountNgn ?? 0), 0);

  if (!Number.isFinite(totalAmountNgn) || totalAmountNgn <= 0) {
    throw new Error("No valid withdrawal amount is available.");
  }

  let recipientCode = existingRecipientCode;

  const transferReference = buildSettlementBatchReference(input.agentUser.id);
  const reason = `CashNode agent withdrawal (${eligibleRequests.length} payouts)`;

  if (getAutomaticSettlementUnavailableReason()) {
    return queueManualWithdrawalRequests({
      collection,
      eligibleRequests,
      transferReference,
      reason,
      recipientCode
    });
  }

  try {
    if (!recipientCode) {
      const recipient = await createPaystackTransferRecipient({
        name: accountName,
        accountNumber,
        bankCode,
        description: `CashNode agent ${input.agentUser.displayName || input.agentUser.phoneNumber}`
      });
      recipientCode = recipient.recipientCode;
      await updateAgentSettlementRecipientCode({
        userId: input.agentUser.id,
        recipientCode
      });
    }

    await collection.updateMany(
      { _id: { $in: eligibleRequests.map((request) => request._id) } },
      {
        $set: {
          "settlement.provider": "paystack",
          "settlement.status": "recipient_created",
          "settlement.recipientCode": recipientCode,
          "settlement.reason": reason,
          "settlement.initiatedAt": new Date(),
          "settlement.lastCheckedAt": new Date(),
          updatedAt: new Date()
        },
        $unset: {
          "settlement.failedAt": "",
          "settlement.failureReason": "",
          "settlement.completedAt": "",
          "settlement.transferCode": "",
          "settlement.transferReference": ""
        }
      }
    );

    const transfer = await initiatePaystackTransfer({
      recipientCode: recipientCode!,
      amountNgn: totalAmountNgn,
      reference: transferReference,
      reason
    });
    const nextStatus = mapPaystackStatusToSettlementStatus(transfer.status);
    const now = new Date();
    const setPayload: Record<string, unknown> = {
      "settlement.provider": "paystack",
      "settlement.status": nextStatus,
      "settlement.transferReference": transfer.reference,
      "settlement.lastCheckedAt": now,
      updatedAt: now
    };

    if (transfer.transferCode) {
      setPayload["settlement.transferCode"] = transfer.transferCode;
    }

    if (nextStatus === "transfer_success") {
      setPayload["settlement.completedAt"] = now;
    }

    if (nextStatus === "transfer_failed") {
      setPayload["settlement.failedAt"] = now;
      setPayload["settlement.failureReason"] = "Paystack returned a failed status.";
    }

    await collection.updateMany(
      { _id: { $in: eligibleRequests.map((request) => request._id) } },
      {
        $set: setPayload,
        ...(nextStatus === "transfer_success"
          ? {
              $unset: {
                "settlement.failedAt": "",
                "settlement.failureReason": ""
              }
            }
          : {})
      }
    );
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : "Unable to run withdrawal transfer.";

    if (shouldQueueManualWithdrawal(failureReason)) {
      return queueManualWithdrawalRequests({
        collection,
        eligibleRequests,
        transferReference,
        reason,
        recipientCode
      });
    }

    await collection.updateMany(
      { _id: { $in: eligibleRequests.map((request) => request._id) } },
      {
        $set: {
          "settlement.provider": "paystack",
          "settlement.status": "transfer_failed",
          "settlement.transferReference": transferReference,
          "settlement.lastCheckedAt": new Date(),
          "settlement.failedAt": new Date(),
          "settlement.failureReason": failureReason,
          updatedAt: new Date()
        }
      }
    );

    throw error;
  }

  const refreshedRequests = await collection
    .find({ _id: { $in: eligibleRequests.map((request) => request._id) } })
    .sort({ completedAt: 1, updatedAt: 1 })
    .toArray();

  return refreshedRequests.map(serializePayoutRequest);
}

export async function createPayoutRequest(input: {
  senderUser: AppUser;
  receiverName: string;
  receiverPhone: string;
  pickupArea: string;
  pickupLocationDetail?: string;
  notes?: string;
  tokenType?: StableToken;
  tokenAmount: number;
}) {
  const collection = await getPayoutRequestsCollection();
  const now = new Date();
  const receiverName = ensureRequiredText(input.receiverName, "Receiver name");
  const receiverPhone = normalizePhoneNumber(input.receiverPhone);
  const pickupArea = ensureRequiredText(input.pickupArea, "Pickup area");
  const pickupLocationDetail = normalizeOptionalText(input.pickupLocationDetail);
  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  const tokenType = ensureStableToken(input.tokenType);
  const tokenAmount = Number(input.tokenAmount);
  const resolvedPickupLocation = findPickupLocation(pickupArea);

  if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) {
    throw new Error("Enter a valid USDT payout amount.");
  }

  if (!resolvedPickupLocation) {
    throw new Error("Select a valid pickup area for the receiver.");
  }

  const platformFeeToken = roundCurrency(tokenAmount * 0.002);
  const agentFeeToken = roundCurrency(Math.max(tokenAmount * 0.005, 2.5));
  const totalToken = roundCurrency(tokenAmount + platformFeeToken + agentFeeToken);
  const quoteReference = `quote-${generateReference().toLowerCase()}`;
  const quote = await createBitnobUsdtNgnQuote({
    tokenAmount,
    reference: quoteReference
  });
  const executedPayout = await executeBitnobUsdtNgnPayout({
    quote,
    requestReference: quote.reference
  });
  const conversionStatus = mapBitnobEventToQuoteStatus(executedPayout.status);

  if (conversionStatus === "failed" || conversionStatus === "expired" || conversionStatus === "quoted") {
    throw new Error("Bitnob conversion did not reach an executable payout state. Please retry.");
  }

  const estimatedLocalAmount = Math.round(executedPayout.settlementAmountNgn);
  const receiverUser = await getUserByPhoneAndRole(receiverPhone, "receiver");
  const requestReference = generateReference();

  const insertResult = await collection.insertOne({
    reference: requestReference,
    senderUserId: ensureObjectId(input.senderUser.id, "sender user id"),
    senderName: input.senderUser.displayName || "CashNode Sender",
    senderPhone: input.senderUser.phoneNumber,
    receiverName,
    receiverPhone,
    receiverUserId: receiverUser ? ensureObjectId(receiverUser.id, "receiver user id") : undefined,
    pickupArea: resolvedPickupLocation.area,
    pickupLocationDetail: pickupLocationDetail || undefined,
    pickupLocation: resolvedPickupLocation.address,
    pickupLatitude: resolvedPickupLocation.latitude,
    pickupLongitude: resolvedPickupLocation.longitude,
    notes,
    tokenType,
    tokenAmount: roundCurrency(tokenAmount),
    estimatedLocalAmount,
    localCurrency: "NGN",
    platformFeeToken,
    agentFeeToken,
    totalToken,
    conversionQuote: {
      provider: "bitnob",
      status: conversionStatus,
      quoteId: executedPayout.quoteId,
      payoutId: executedPayout.payoutId,
      reference: executedPayout.reference,
      rate: executedPayout.rate,
      settlementAmountNgn: executedPayout.settlementAmountNgn,
      amountToken: roundCurrency(executedPayout.amountToken),
      feesToken: roundCurrency(executedPayout.feesToken),
      lastEventAt: now,
      expiresAt: new Date(executedPayout.expiresAt),
      createdAt: now
    },
    collectionCode: generateCollectionCode(),
    status: "open",
    createdAt: now,
    updatedAt: now
  });

  const createdDocument = await collection.findOne({ _id: insertResult.insertedId });

  if (!createdDocument) {
    throw new Error("Failed to create payout request.");
  }

  return serializePayoutRequest(createdDocument);
}

export async function listSenderPayoutRequests(senderUserId: string) {
  const collection = await getPayoutRequestsCollection();
  const documents = await collection.find({ senderUserId: ensureObjectId(senderUserId, "sender user id") }).sort({ updatedAt: -1 }).toArray();
  const refreshedDocuments: WithId<PayoutRequestDocument>[] = [];

  for (const document of documents) {
    const refreshedDocument = await refreshRequestSettlementStateOnly(collection, document);
    refreshedDocuments.push(refreshedDocument);
  }

  return refreshedDocuments.map(serializePayoutRequest);
}

export async function listAdminPayoutRequests() {
  const collection = await getPayoutRequestsCollection();
  const documents = await collection.find({}).sort({ updatedAt: -1 }).limit(250).toArray();
  const refreshedDocuments: WithId<PayoutRequestDocument>[] = [];

  for (const document of documents) {
    const refreshedDocument = await refreshRequestSettlementStateOnly(collection, document);
    refreshedDocuments.push(refreshedDocument);
  }

  return refreshedDocuments.map(serializePayoutRequest);
}

export async function updateAdminSettlementStatus(input: {
  requestId: string;
  status: Extract<SettlementStatus, "withdrawal_requested" | "transfer_success" | "transfer_failed">;
  note?: string;
}) {
  const collection = await getPayoutRequestsCollection();
  const _id = ensureObjectId(input.requestId, "request id");
  const document = await collection.findOne({ _id });

  if (!document) {
    throw new Error("Payout request not found.");
  }

  if (!document.settlement) {
    throw new Error("This payout does not have an agent settlement record yet.");
  }

  const now = new Date();
  const note = normalizeOptionalText(input.note);
  const setPayload: Record<string, unknown> = {
    "settlement.provider": "manual",
    "settlement.status": input.status,
    "settlement.lastCheckedAt": now,
    updatedAt: now
  };
  const unsetPayload: Record<string, ""> = {};

  if (input.status === "withdrawal_requested") {
    setPayload["settlement.initiatedAt"] = document.settlement.initiatedAt ?? now;
    setPayload["settlement.reason"] = note || document.settlement.reason || "Queued for manual admin payout.";
    setPayload["settlement.failureReason"] = note || MANUAL_WITHDRAWAL_QUEUE_MESSAGE;
    unsetPayload["settlement.completedAt"] = "";
    unsetPayload["settlement.failedAt"] = "";
    unsetPayload["settlement.transferCode"] = "";
    unsetPayload["settlement.transferReference"] = "";
  }

  if (input.status === "transfer_success") {
    setPayload["settlement.completedAt"] = now;
    if (note) {
      setPayload["settlement.reason"] = note;
    }
    unsetPayload["settlement.failedAt"] = "";
    unsetPayload["settlement.failureReason"] = "";
  }

  if (input.status === "transfer_failed") {
    setPayload["settlement.failedAt"] = now;
    setPayload["settlement.failureReason"] = note || "Manual admin payout was marked failed.";
    unsetPayload["settlement.completedAt"] = "";
  }

  const updateResult = await collection.updateOne(
    { _id },
    {
      $set: setPayload,
      ...(Object.keys(unsetPayload).length > 0 ? { $unset: unsetPayload } : {})
    }
  );

  if (updateResult.matchedCount !== 1) {
    throw new Error("Payout request not found or already processed.");
  }

  const updatedDocument = await collection.findOne({ _id });

  if (!updatedDocument) {
    throw new Error("Unable to reload the updated payout request.");
  }

  return serializePayoutRequest(updatedDocument);
}

export async function listAvailablePayoutRequests(agentUser?: AppUser) {
  const collection = await getPayoutRequestsCollection();
  const documents = await collection.find({ status: "open" }).sort({ createdAt: -1 }).toArray();

  if (!agentUser) {
    return documents.map(serializePayoutRequest);
  }

  if (!agentUser.agentProfile || agentUser.agentProfile.manualReviewRequired) {
    return [];
  }
  const agentProfile = agentUser.agentProfile;

  const livePresence = await getFreshOnlineAgentPresenceByUserId(agentUser.id);
  const referenceCoordinates =
    livePresence && typeof livePresence.latitude === "number" && typeof livePresence.longitude === "number"
      ? {
          latitude: livePresence.latitude,
          longitude: livePresence.longitude
        }
      : {
          latitude: agentProfile.serviceLatitude,
          longitude: agentProfile.serviceLongitude
        };

  const { activeLoadByAgentId } = await getAgentRequestLoadStats(collection, [agentUser.id]);
  const remainingCapacityNgn = agentProfile.dailyCapacityNgn - (activeLoadByAgentId.get(agentUser.id) ?? 0);

  return documents
    .filter(
      (document) =>
        !((document.excludedAgentUserIds ?? []).some((agentId) => agentId.toHexString() === agentUser.id)) &&
        document.estimatedLocalAmount <= remainingCapacityNgn &&
        document.estimatedLocalAmount <= agentProfile.maxSinglePayoutNgn
    )
    .sort((left, right) => {
      const leftDistance = calculateDistanceKm(
        ensureCoordinates(referenceCoordinates.latitude, referenceCoordinates.longitude),
        {
          latitude: left.pickupLatitude ?? resolvePickupLocation(left.pickupArea || left.pickupLocation).latitude,
          longitude: left.pickupLongitude ?? resolvePickupLocation(left.pickupArea || left.pickupLocation).longitude
        }
      );
      const rightDistance = calculateDistanceKm(
        ensureCoordinates(referenceCoordinates.latitude, referenceCoordinates.longitude),
        {
          latitude: right.pickupLatitude ?? resolvePickupLocation(right.pickupArea || right.pickupLocation).latitude,
          longitude: right.pickupLongitude ?? resolvePickupLocation(right.pickupArea || right.pickupLocation).longitude
        }
      );

      return leftDistance - rightDistance;
    })
    .map(serializePayoutRequest);
}

export async function listAssignedAgentPayoutRequests(agentUserId: string) {
  const collection = await getPayoutRequestsCollection();
  const documents = await collection
    .find({
      "assignedAgent.userId": ensureObjectId(agentUserId, "agent user id"),
      status: { $in: ["accepted", "completed"] }
    })
    .sort({ updatedAt: -1 })
    .toArray();

  const refreshedDocuments: WithId<PayoutRequestDocument>[] = [];

  for (const document of documents) {
    const refreshed = await refreshRequestSettlementStateOnly(collection, document);

    if (refreshed.assignedAgent?.userId?.toHexString() === agentUserId) {
      refreshedDocuments.push(refreshed);
    }
  }

  return refreshedDocuments.map(serializePayoutRequest);
}

export async function listReceiverPayoutRequests(receiverPhone: string) {
  const collection = await getPayoutRequestsCollection();
  const documents = await collection.find({ receiverPhone }).sort({ updatedAt: -1 }).toArray();
  const refreshedDocuments: WithId<PayoutRequestDocument>[] = [];

  for (const document of documents) {
    const refreshedDocument = await refreshRequestRuntimeState(collection, document);
    refreshedDocuments.push(refreshedDocument);
  }

  return refreshedDocuments.map(serializePayoutRequest);
}

export async function getPayoutRequestById(requestId: string) {
  const collection = await getPayoutRequestsCollection();
  const document = await collection.findOne({ _id: ensureObjectId(requestId, "request id") });

  if (!document) {
    return null;
  }

  const refreshedDocument = await refreshRequestRuntimeState(collection, document);
  return serializePayoutRequest(refreshedDocument);
}

export async function getPayoutRequestByIdForUser(requestId: string, user: AppUser) {
  const collection = await getPayoutRequestsCollection();
  const document = await collection.findOne({ _id: ensureObjectId(requestId, "request id") });

  if (!document) {
    return null;
  }

  const refreshedDocument = await refreshRequestSettlementStateOnly(collection, document);
  const isSender = refreshedDocument.senderUserId.toHexString() === user.id;
  const isReceiverByPhone = refreshedDocument.receiverPhone === user.phoneNumber;
  const isAssignedAgent = refreshedDocument.assignedAgent?.userId.toHexString() === user.id;
  const canViewOpenAgentRequest = Boolean(user.agentProfile && refreshedDocument.status === "open");

  if (!isSender && !isReceiverByPhone && !isAssignedAgent && !canViewOpenAgentRequest) {
    throw new Error("You do not have access to this request.");
  }

  return serializePayoutRequest(refreshedDocument);
}

export async function initializePayoutEscrow(input: {
  requestId: string;
  senderUser: AppUser;
  senderWallet: string;
  escrowAddress: string;
  referenceSeed: string;
  amountTokenUnits: number;
  agentFeeTokenUnits: number;
  platformFeeTokenUnits?: number;
  programId: string;
  cluster: string;
}) {
  const collection = await getPayoutRequestsCollection();
  const _id = ensureObjectId(input.requestId, "request id");
  const document = await collection.findOne({ _id });

  if (!document) {
    throw new Error("Payout request not found.");
  }

  if (document.senderUserId.toHexString() !== input.senderUser.id) {
    throw new Error("Only the sender can initialize escrow for this request.");
  }

  if (document.status !== "open") {
    throw new Error("Escrow can only be initialized while the request is open.");
  }

  const now = new Date();

  const updateResult = await collection.updateOne(
    { _id, status: "open", senderUserId: ensureObjectId(input.senderUser.id, "sender user id") },
    {
      $set: {
        escrow: {
          provider: "solana",
          cluster: input.cluster,
          programId: input.programId,
          status: "pending_signature",
          escrowAddress: input.escrowAddress,
          referenceSeed: input.referenceSeed,
          senderWallet: input.senderWallet,
          agentWallet: document.escrow?.agentWallet ?? null,
          amountTokenUnits: input.amountTokenUnits,
          agentFeeTokenUnits: input.agentFeeTokenUnits,
          platformFeeTokenUnits: input.platformFeeTokenUnits ?? 0,
          createdAt: document.escrow?.createdAt ?? now,
          updatedAt: now
        },
        updatedAt: now
      }
    }
  );

  if (updateResult.modifiedCount === 0) {
    throw new Error("Request is no longer open. Refresh and try again.");
  }

  const updatedDocument = await collection.findOne({ _id });

  if (!updatedDocument) {
    throw new Error("Failed to initialize request escrow.");
  }

  return serializePayoutRequest(updatedDocument);
}

export async function recordPayoutEscrowSignature(input: {
  requestId: string;
  actorUser: AppUser;
  action: "create" | "accept" | "mark_paid" | "complete" | "cancel";
  signature: string;
  walletAddress: string;
  escrowAddress?: string;
  referenceSeed?: string;
}) {
  const collection = await getPayoutRequestsCollection();
  const _id = ensureObjectId(input.requestId, "request id");
  const document = await collection.findOne({ _id });

  if (!document) {
    throw new Error("Payout request not found.");
  }

  const isSender = document.senderUserId.toHexString() === input.actorUser.id;
  const isAssignedAgent = document.assignedAgent?.userId.toHexString() === input.actorUser.id;

  if ((input.action === "create" || input.action === "complete" || input.action === "cancel") && !isSender) {
    throw new Error("Only the sender can record this escrow action.");
  }

  if ((input.action === "accept" || input.action === "mark_paid") && !isAssignedAgent) {
    throw new Error("Only the assigned agent can record this escrow action.");
  }

  const now = new Date();
  const currentEscrow = document.escrow;
  const setPayload: Record<string, unknown> = {
    updatedAt: now,
    "escrow.updatedAt": now,
    "escrow.failureReason": null
  };

  if (input.action === "create") {
    setPayload["escrow.status"] = "funded";
    setPayload["escrow.createSignature"] = input.signature;
    setPayload["escrow.senderWallet"] = input.walletAddress;
  }

  if (input.action === "accept") {
    setPayload["escrow.status"] = "accepted";
    setPayload["escrow.acceptSignature"] = input.signature;
    setPayload["escrow.agentWallet"] = input.walletAddress;
  }

  if (input.action === "mark_paid") {
    setPayload["escrow.status"] = "paid";
    setPayload["escrow.markPaidSignature"] = input.signature;
    setPayload["escrow.agentWallet"] = input.walletAddress;
  }

  if (input.action === "complete") {
    setPayload["escrow.status"] = "completed";
    setPayload["escrow.completeSignature"] = input.signature;
  }

  if (input.action === "cancel") {
    setPayload["escrow.status"] = "cancelled";
    setPayload["escrow.cancelSignature"] = input.signature;
  }

  if (!currentEscrow) {
    throw new Error("Initialize and fund escrow before recording this action.");
  }

  const signatureField = ESCROW_ACTION_SIGNATURE_FIELD[input.action];
  const targetStatus = ESCROW_ACTION_TARGET_STATUS[input.action];
  const existingSignature = currentEscrow[signatureField];

  if (existingSignature === input.signature && currentEscrow.status === targetStatus) {
    return serializePayoutRequest(document);
  }

  const validFromStates = VALID_ESCROW_TRANSITIONS[input.action];

  if (!validFromStates.includes(currentEscrow.status)) {
    throw new Error(`Cannot perform '${input.action}' when escrow is '${currentEscrow.status}'.`);
  }

  if (input.escrowAddress) {
    setPayload["escrow.escrowAddress"] = input.escrowAddress;
  }

  if (input.referenceSeed) {
    setPayload["escrow.referenceSeed"] = input.referenceSeed;
  }

  if (input.action === "cancel") {
    setPayload.status = "cancelled";
    setPayload.cancelledAt = now;
  }

  const updateResult = await collection.updateOne({ _id }, { $set: setPayload });

  if (updateResult.matchedCount !== 1) {
    throw new Error("Failed to record escrow signature.");
  }

  const updatedDocument = await collection.findOne({ _id });

  if (!updatedDocument) {
    throw new Error("Failed to record escrow signature.");
  }

  return serializePayoutRequest(updatedDocument);
}

export async function getLatestRelevantPayoutRequest(user: AppUser) {
  const collection = await getPayoutRequestsCollection();
  const filter = {
    $or: [
      { senderUserId: ensureObjectId(user.id, "sender user id") },
      { receiverPhone: user.phoneNumber },
      { "assignedAgent.userId": ensureObjectId(user.id, "agent user id") },
      ...(user.agentProfile ? [{ status: "open" as const }] : [])
    ]
  };

  const document = await collection
    .find(filter)
    .sort({
      updatedAt: -1
    })
    .limit(1)
    .next();

  if (!document) {
    return null;
  }

  const refreshedDocument = await refreshRequestSettlementStateOnly(collection, document);
  return serializePayoutRequest(refreshedDocument);
}

export async function acceptPayoutRequest(input: { requestId: string; agentUser: AppUser }) {
  const collection = await getPayoutRequestsCollection();
  const _id = ensureObjectId(input.requestId, "request id");
  const document = await collection.findOne({ _id });

  if (!document) {
    throw new Error("Payout request not found.");
  }

  ensureStatusTransition(document.status, "open");
  const excludedAgentUserIds = new Set((document.excludedAgentUserIds ?? []).map((agentId) => agentId.toHexString()));

  if (excludedAgentUserIds.has(input.agentUser.id)) {
    throw new Error("This request cannot be reassigned to this agent right now.");
  }

  const agentProfile = ensureAgentOperationalEligibility({
    agentUser: input.agentUser,
    requestAmountNgn: document.estimatedLocalAmount
  });
  const livePresence = await getFreshOnlineAgentPresenceByUserId(input.agentUser.id);
  const dispatchReference = getAgentReferenceCoordinates({
    agentUser: input.agentUser,
    livePresence:
      livePresence && typeof livePresence.latitude === "number" && typeof livePresence.longitude === "number"
        ? {
            latitude: livePresence.latitude,
            longitude: livePresence.longitude
          }
        : null
  });

  const { activeLoadByAgentId, completedCountByAgentId } = await getAgentRequestLoadStats(collection, [input.agentUser.id]);
  const currentActiveLoad = activeLoadByAgentId.get(input.agentUser.id) ?? 0;

  if (agentProfile.dailyCapacityNgn - currentActiveLoad < document.estimatedLocalAmount) {
    throw new Error("This payout is above the remaining cash capacity for this agent.");
  }

  const resolvedPickupLocation = resolvePickupLocation(document.pickupArea || document.pickupLocation);
  const distanceKm = calculateDistanceKm(
    ensureCoordinates(dispatchReference.latitude, dispatchReference.longitude),
    {
      latitude: document.pickupLatitude ?? resolvedPickupLocation.latitude,
      longitude: document.pickupLongitude ?? resolvedPickupLocation.longitude
    }
  );
  const now = new Date();

  const acceptResult = await collection.updateOne(
    { _id, status: "open" },
    {
      $set: {
        status: "accepted",
        assignedAgent: buildAssignedAgentSnapshot({
          agentUser: input.agentUser,
          acceptedAt: now,
          distanceKm,
          transferCount: completedCountByAgentId.get(input.agentUser.id) ?? 0,
          locationSource: dispatchReference.source
        }),
        updatedAt: now
      }
    }
  );

  if (acceptResult.modifiedCount === 0) {
    throw new Error("This request is no longer open. Refresh and try again.");
  }

  const updatedDocument = await collection.findOne({ _id });

  if (!updatedDocument) {
    throw new Error("Failed to accept payout request.");
  }

  return serializePayoutRequest(updatedDocument);
}

export async function declinePayoutRequest(input: { requestId: string; agentUser: AppUser }) {
  const collection = await getPayoutRequestsCollection();
  const _id = ensureObjectId(input.requestId, "request id");
  const document = await collection.findOne({ _id });

  if (!document) {
    throw new Error("Payout request not found.");
  }

  ensureStatusTransition(document.status, "accepted");

  if (!document.assignedAgent?.userId || document.assignedAgent.userId.toHexString() !== input.agentUser.id) {
    throw new Error("Only the currently assigned agent can decline this request.");
  }

  const excludedAgentUserIds = new Set([
    ...(document.excludedAgentUserIds ?? []).map((agentId) => agentId.toHexString()),
    input.agentUser.id
  ]);
  const now = new Date();

  const declineResult = await collection.updateOne(
    { _id, status: "accepted", "assignedAgent.userId": ensureObjectId(input.agentUser.id, "agent user id") },
    {
      $set: {
        excludedAgentUserIds: Array.from(excludedAgentUserIds).map((agentUserId) => ensureObjectId(agentUserId, "agent user id")),
        status: "open",
        updatedAt: now
      },
      $unset: {
        assignedAgent: ""
      }
    }
  );

  if (declineResult.modifiedCount === 0) {
    throw new Error("This request is no longer assigned to this agent. Refresh and try again.");
  }

  const reopenedDocument = await collection.findOne({ _id });

  if (!reopenedDocument) {
    throw new Error("Failed to reopen payout request after decline.");
  }

  return serializePayoutRequest(reopenedDocument);
}

export async function completePayoutRequest(input: { requestId: string; actorUser: AppUser }) {
  const collection = await getPayoutRequestsCollection();
  const _id = ensureObjectId(input.requestId, "request id");
  const document = await collection.findOne({ _id });

  if (!document) {
    throw new Error("Payout request not found.");
  }

  ensureStatusTransition(document.status, "accepted");

  const isAssignedAgent = document.assignedAgent?.userId.toHexString() === input.actorUser.id;
  const isReceiverByPhone = document.receiverPhone === input.actorUser.phoneNumber;

  if (!isAssignedAgent && !isReceiverByPhone) {
    throw new Error("You do not have permission to complete this request.");
  }

  const now = new Date();

  if (isAssignedAgent && !isReceiverByPhone) {
    const markPaidResult = await collection.updateOne(
      { _id, status: "accepted", "assignedAgent.userId": ensureObjectId(input.actorUser.id, "actor user id") },
      {
        $set: {
          agentMarkedPaidAt: now,
          updatedAt: now
        }
      }
    );

    if (markPaidResult.modifiedCount === 0) {
      throw new Error("This request can no longer be marked as paid. Refresh and try again.");
    }

    const markedPaidDocument = await collection.findOne({ _id });

    if (!markedPaidDocument) {
      throw new Error("Failed to mark payout as handed out.");
    }

    return serializePayoutRequest(markedPaidDocument);
  }

  const completeResult = await collection.updateOne(
    { _id, status: "accepted", receiverPhone: input.actorUser.phoneNumber },
    {
      $set: {
        status: "completed",
        completedAt: now,
        updatedAt: now
      }
    }
  );

  if (completeResult.modifiedCount === 0) {
    throw new Error("This request can no longer be completed. Refresh and try again.");
  }

  let updatedDocument = await collection.findOne({ _id });

  if (!updatedDocument) {
    throw new Error("Failed to complete payout request.");
  }

  if (updatedDocument.assignedAgent?.userId) {
    const availableWithdrawalAmount = computeAgentSettlementAmountNgn({
      tokenAmount: updatedDocument.tokenAmount,
      agentFeeToken: updatedDocument.agentFeeToken,
      conversionQuote: updatedDocument.conversionQuote,
      estimatedLocalAmount: updatedDocument.estimatedLocalAmount
    });

    await collection.updateOne(
      { _id },
      {
        $set: {
          settlement: {
            provider: resolveSettlementProvider(),
            status: "available_for_withdrawal",
            amountNgn: availableWithdrawalAmount,
            currency: "NGN",
            reason: `CashNode payout ${updatedDocument.reference}`,
            initiatedAt: new Date()
          },
          updatedAt: new Date()
        }
      }
    );

    const settledDocument = await collection.findOne({ _id });

    if (settledDocument) {
      updatedDocument = settledDocument;
    }
  }

  return serializePayoutRequest(updatedDocument);
}

function pickFirstString(values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function extractPaystackTransferFields(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return {
      eventName: "",
      reference: "",
      transferCode: "",
      rawStatus: ""
    };
  }

  const eventRecord = payload as Record<string, unknown>;
  const dataRecord = eventRecord.data && typeof eventRecord.data === "object" ? (eventRecord.data as Record<string, unknown>) : {};

  return {
    eventName: pickFirstString([eventRecord.event]),
    reference: pickFirstString([dataRecord.reference, dataRecord.transfer_reference, eventRecord.reference]),
    transferCode: pickFirstString([dataRecord.transfer_code, dataRecord.transferCode]),
    rawStatus: pickFirstString([dataRecord.status])
  };
}

export async function applyPaystackTransferWebhook(payload: unknown) {
  const collection = await getPayoutRequestsCollection();
  const fields = extractPaystackTransferFields(payload);
  const normalizedEvent = fields.eventName.toLowerCase();
  const statusHint = fields.rawStatus.toLowerCase();
  const derivedStatus = mapPaystackStatusToSettlementStatus(
    statusHint ||
      (normalizedEvent.includes("success")
        ? "success"
        : normalizedEvent.includes("failed")
          ? "failed"
          : normalizedEvent.includes("reversed")
            ? "reversed"
            : "pending")
  );

  if (!fields.reference) {
    return {
      matchedRequest: false,
      reason: "Missing transfer reference in webhook payload."
    };
  }

  const requestDocument = await collection.findOne({
    "settlement.transferReference": fields.reference
  });

  if (!requestDocument) {
    return {
      matchedRequest: false,
      reason: "No payout request found for transfer reference.",
      transferReference: fields.reference
    };
  }

  const now = new Date();
  const setPayload: Record<string, unknown> = {
    "settlement.status": derivedStatus,
    "settlement.transferReference": fields.reference,
    "settlement.lastCheckedAt": now,
    updatedAt: now
  };

  if (fields.transferCode) {
    setPayload["settlement.transferCode"] = fields.transferCode;
  }

  if (derivedStatus === "transfer_success") {
    setPayload["settlement.completedAt"] = now;
  }

  if (derivedStatus === "transfer_failed") {
    setPayload["settlement.failedAt"] = now;
    setPayload["settlement.failureReason"] = `Paystack event ${fields.eventName || "transfer.failed"}`;
  }

  await collection.updateOne(
    { _id: requestDocument._id },
    {
      $set: setPayload,
      ...(derivedStatus === "transfer_success"
        ? {
            $unset: {
              "settlement.failureReason": ""
            }
          }
        : {})
    }
  );

  return {
    matchedRequest: true,
    requestId: requestDocument._id.toHexString(),
    transferReference: fields.reference,
    settlementStatus: derivedStatus
  };
}

function extractBitnobPayoutFields(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return {
      eventName: "",
      externalId: "",
      quoteId: "",
      payoutId: "",
      reference: "",
      failureReason: ""
    };
  }

  const eventRecord = payload as Record<string, unknown>;
  const dataRecord = eventRecord.data && typeof eventRecord.data === "object" ? (eventRecord.data as Record<string, unknown>) : {};
  const quoteRecord = dataRecord.quote && typeof dataRecord.quote === "object" ? (dataRecord.quote as Record<string, unknown>) : {};

  return {
    eventName: pickFirstString([eventRecord.event, dataRecord.event]),
    externalId: pickFirstString([eventRecord.id, dataRecord.id]),
    quoteId: pickFirstString([dataRecord.quoteId, dataRecord.quote_id, quoteRecord.id]),
    payoutId: pickFirstString([dataRecord.payoutId, dataRecord.payout_id, dataRecord.id]),
    reference: pickFirstString([dataRecord.reference, quoteRecord.reference, eventRecord.reference]),
    failureReason: pickFirstString([dataRecord.failure_reason, dataRecord.reason, eventRecord.reason])
  };
}

export async function applyBitnobPayoutWebhook(payload: unknown) {
  const collection = await getPayoutRequestsCollection();
  const fields = extractBitnobPayoutFields(payload);
  const nextQuoteStatus = mapBitnobEventToQuoteStatus(fields.eventName);

  const queryCandidates: Record<string, string>[] = [];

  if (fields.quoteId) {
    queryCandidates.push({ "conversionQuote.quoteId": fields.quoteId });
  }

  if (fields.payoutId) {
    queryCandidates.push({ "conversionQuote.payoutId": fields.payoutId });
  }

  if (fields.reference) {
    queryCandidates.push({ "conversionQuote.reference": fields.reference });
  }

  if (queryCandidates.length === 0) {
    return {
      matchedRequest: false,
      reason: "Missing Bitnob reference identifiers in webhook payload."
    };
  }

  const requestDocument = await collection.findOne({
    $or: queryCandidates
  });

  if (!requestDocument) {
    return {
      matchedRequest: false,
      reason: "No payout request found for Bitnob identifiers."
    };
  }

  const now = new Date();
  const setPayload: Record<string, unknown> = {
    "conversionQuote.status": nextQuoteStatus,
    "conversionQuote.lastEventAt": now,
    updatedAt: now
  };

  if (fields.quoteId) {
    setPayload["conversionQuote.quoteId"] = fields.quoteId;
  }

  if (fields.payoutId) {
    setPayload["conversionQuote.payoutId"] = fields.payoutId;
  }

  if (fields.reference) {
    setPayload["conversionQuote.reference"] = fields.reference;
  }

  if (nextQuoteStatus === "failed" || nextQuoteStatus === "expired") {
    setPayload["conversionQuote.failureReason"] = fields.failureReason || `Bitnob event ${fields.eventName}`;
  }

  await collection.updateOne(
    { _id: requestDocument._id },
    {
      $set: setPayload,
      ...(nextQuoteStatus === "success" || nextQuoteStatus === "processing" || nextQuoteStatus === "initialized"
        ? {
            $unset: {
              "conversionQuote.failureReason": ""
            }
          }
        : {})
    }
  );

  return {
    matchedRequest: true,
    requestId: requestDocument._id.toHexString(),
    quoteStatus: nextQuoteStatus,
    eventName: fields.eventName
  };
}

export async function cancelPayoutRequest(input: { requestId: string; senderUser: AppUser }) {
  const collection = await getPayoutRequestsCollection();
  const _id = ensureObjectId(input.requestId, "request id");
  const document = await collection.findOne({ _id });

  if (!document) {
    throw new Error("Payout request not found.");
  }

  if (document.senderUserId.toHexString() !== input.senderUser.id) {
    throw new Error("You do not have permission to cancel this request.");
  }

  if (document.status !== "open") {
    throw new Error("Only open requests can be cancelled.");
  }

  if (
    document.escrow?.status &&
    document.escrow.status !== "pending_signature" &&
    document.escrow.status !== "failed" &&
    document.escrow.status !== "cancelled"
  ) {
    throw new Error("This request has secured funds and cannot be cancelled without an on-chain refund transaction.");
  }

  const now = new Date();

  const cancelResult = await collection.updateOne(
    { _id, status: "open", senderUserId: ensureObjectId(input.senderUser.id, "sender user id") },
    {
      $set: {
        status: "cancelled",
        cancelledAt: now,
        updatedAt: now
      }
    }
  );

  if (cancelResult.modifiedCount === 0) {
    throw new Error("This request can no longer be cancelled. Refresh and try again.");
  }

  const updatedDocument = await collection.findOne({ _id });

  if (!updatedDocument) {
    throw new Error("Failed to cancel payout request.");
  }

  return serializePayoutRequest(updatedDocument);
}
