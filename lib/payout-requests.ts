import { ObjectId, type Collection, type WithId } from "mongodb";
import { getFreshOnlineAgentPresenceByUserId, listFreshOnlineAgentPresenceMap } from "@/lib/agent-presence";
import { getMongoDb } from "@/lib/mongodb";
import {
  buildPickupDirectionsUrl,
  buildPickupMapEmbedUrl,
  calculateDistanceKm,
  findPickupLocation,
  formatDistanceLabel,
  formatPickupCoordinates,
  resolvePickupLocation
} from "@/lib/pickup-locations";
import { getUserByPhoneAndRole, listActiveAgentUsers, type AppUser } from "@/lib/users";

export type PayoutRequestStatus = "open" | "accepted" | "completed" | "cancelled";

type AgentAssignmentDocument = {
  userId: ObjectId;
  name: string;
  phoneNumber: string;
  rating: number;
  transferCount: number;
  acceptedAt: Date;
  distanceKm?: number;
  serviceZone?: string;
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
  pickupLocation: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  notes: string;
  amountUsd: number;
  estimatedLocalAmount: number;
  localCurrency: "NGN";
  platformFeeUsd: number;
  agentFeeUsd: number;
  totalUsd: number;
  collectionCode: string;
  status: PayoutRequestStatus;
  assignedAgent?: AgentAssignmentDocument;
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
  pickupLocation: string;
  pickupLatitude: number;
  pickupLongitude: number;
  pickupCoordinatesLabel: string;
  pickupDirectionsUrl: string;
  pickupMapEmbedUrl: string;
  notes: string;
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
    serviceZone: string | null;
  } | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const COLLECTION_NAME = "payout_requests";
const LOCAL_EXCHANGE_RATE = 1550;
let indexSetupPromise: Promise<void> | null = null;

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
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

function calculateAgentRating(transferCount: number) {
  return Math.min(4.99, Number((4.84 + Math.min(transferCount, 15) * 0.01).toFixed(2)));
}

function ensureAgentDispatchProfile(agentUser: AppUser) {
  if (!agentUser.agentProfile || !agentUser.walletAddress) {
    throw new Error("This agent is not fully configured for live dispatch yet.");
  }

  return agentUser.agentProfile;
}

function buildAssignedAgentSnapshot(input: {
  agentUser: AppUser;
  acceptedAt: Date;
  distanceKm: number;
  transferCount: number;
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
    serviceZone: agentProfile.serviceZone
  };
}

function ensureLivePresenceCoordinates(latitude?: number | null, longitude?: number | null) {
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    throw new Error("A fresh live location is required for this agent.");
  }

  return {
    latitude,
    longitude
  };
}

function serializePayoutRequest(document: WithId<PayoutRequestDocument>): PayoutRequestRecord {
  const resolvedPickupLocation = resolvePickupLocation(document.pickupArea || document.pickupLocation);
  const pickupLatitude = document.pickupLatitude ?? resolvedPickupLocation.latitude;
  const pickupLongitude = document.pickupLongitude ?? resolvedPickupLocation.longitude;
  const pickupArea = resolvedPickupLocation.area;
  const pickupLocation = resolvedPickupLocation.address;

  return {
    id: document._id.toHexString(),
    reference: document.reference,
    senderUserId: document.senderUserId.toHexString(),
    senderName: document.senderName,
    senderPhone: document.senderPhone,
    receiverName: document.receiverName,
    receiverPhone: document.receiverPhone,
    receiverUserId: document.receiverUserId?.toHexString() ?? null,
    pickupArea,
    pickupLocation,
    pickupLatitude,
    pickupLongitude,
    pickupCoordinatesLabel: formatPickupCoordinates(pickupLatitude, pickupLongitude),
    pickupDirectionsUrl: buildPickupDirectionsUrl({
      ...resolvedPickupLocation,
      latitude: pickupLatitude,
      longitude: pickupLongitude
    }),
    pickupMapEmbedUrl: buildPickupMapEmbedUrl({
      latitude: pickupLatitude,
      longitude: pickupLongitude
    }),
    notes: document.notes,
    amountUsd: document.amountUsd,
    estimatedLocalAmount: document.estimatedLocalAmount,
    localCurrency: document.localCurrency,
    platformFeeUsd: document.platformFeeUsd,
    agentFeeUsd: document.agentFeeUsd,
    totalUsd: document.totalUsd,
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
          serviceZone: document.assignedAgent.serviceZone ?? null
        }
      : null,
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
}) {
  const activeAgents = await listActiveAgentUsers();

  if (activeAgents.length === 0) {
    return null;
  }

  const { activeLoadByAgentId, completedCountByAgentId } = await getAgentRequestLoadStats(
    input.collection,
    activeAgents.map((agent) => agent.id)
  );
  const livePresenceByAgentId = await listFreshOnlineAgentPresenceMap(activeAgents.map((agent) => agent.id));

  const eligibleAgents = activeAgents
    .flatMap((agentUser) => {
      if (!agentUser.agentProfile || !agentUser.walletAddress) {
        return [];
      }

      const livePresence = livePresenceByAgentId.get(agentUser.id);

      if (!livePresence) {
        return [];
      }

      const activeLoadNgn = activeLoadByAgentId.get(agentUser.id) ?? 0;
      const remainingCapacityNgn = agentUser.agentProfile.dailyCapacityNgn - activeLoadNgn;

      if (remainingCapacityNgn < input.estimatedLocalAmount) {
        return [];
      }

      const distanceKm = calculateDistanceKm(
        ensureLivePresenceCoordinates(livePresence.latitude, livePresence.longitude),
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
          transferCount: completedCountByAgentId.get(agentUser.id) ?? 0
        }
      ];
    })
    .sort((left, right) => {
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

export async function createPayoutRequest(input: {
  senderUser: AppUser;
  receiverName: string;
  receiverPhone: string;
  pickupArea: string;
  notes?: string;
  amountUsd: number;
}) {
  const collection = await getPayoutRequestsCollection();
  const now = new Date();
  const receiverName = ensureRequiredText(input.receiverName, "Receiver name");
  const receiverPhone = normalizePhoneNumber(input.receiverPhone);
  const pickupArea = ensureRequiredText(input.pickupArea, "Pickup area");
  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  const amountUsd = Number(input.amountUsd);
  const resolvedPickupLocation = findPickupLocation(pickupArea);

  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    throw new Error("Enter a valid payout amount.");
  }

  if (!resolvedPickupLocation) {
    throw new Error("Select a valid pickup area for the receiver.");
  }

  const platformFeeUsd = roundCurrency(amountUsd * 0.002);
  const agentFeeUsd = roundCurrency(Math.max(amountUsd * 0.005, 2.5));
  const totalUsd = roundCurrency(amountUsd + platformFeeUsd + agentFeeUsd);
  const estimatedLocalAmount = Math.round(amountUsd * LOCAL_EXCHANGE_RATE);
  const receiverUser = await getUserByPhoneAndRole(receiverPhone, "receiver");
  const nearestEligibleAgent = await findNearestEligibleAgent({
    collection,
    pickupLatitude: resolvedPickupLocation.latitude,
    pickupLongitude: resolvedPickupLocation.longitude,
    estimatedLocalAmount
  });

  const insertResult = await collection.insertOne({
    reference: generateReference(),
    senderUserId: ensureObjectId(input.senderUser.id, "sender user id"),
    senderName: input.senderUser.displayName || "CashNode Sender",
    senderPhone: input.senderUser.phoneNumber,
    receiverName,
    receiverPhone,
    receiverUserId: receiverUser ? ensureObjectId(receiverUser.id, "receiver user id") : undefined,
    pickupArea: resolvedPickupLocation.area,
    pickupLocation: resolvedPickupLocation.address,
    pickupLatitude: resolvedPickupLocation.latitude,
    pickupLongitude: resolvedPickupLocation.longitude,
    notes,
    amountUsd: roundCurrency(amountUsd),
    estimatedLocalAmount,
    localCurrency: "NGN",
    platformFeeUsd,
    agentFeeUsd,
    totalUsd,
    collectionCode: generateCollectionCode(),
    status: nearestEligibleAgent ? "accepted" : "open",
    assignedAgent: nearestEligibleAgent
      ? buildAssignedAgentSnapshot({
          agentUser: nearestEligibleAgent.agentUser,
          acceptedAt: now,
          distanceKm: nearestEligibleAgent.distanceKm,
          transferCount: nearestEligibleAgent.transferCount
        })
      : undefined,
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
  return documents.map(serializePayoutRequest);
}

export async function listAvailablePayoutRequests(agentUser?: AppUser) {
  const collection = await getPayoutRequestsCollection();
  const documents = await collection.find({ status: "open" }).sort({ createdAt: -1 }).toArray();

  if (!agentUser) {
    return documents.map(serializePayoutRequest);
  }

  if (!agentUser.agentProfile || !agentUser.walletAddress) {
    return [];
  }

  const livePresence = await getFreshOnlineAgentPresenceByUserId(agentUser.id);
  const referenceCoordinates =
    livePresence && typeof livePresence.latitude === "number" && typeof livePresence.longitude === "number"
      ? {
          latitude: livePresence.latitude,
          longitude: livePresence.longitude
        }
      : {
          latitude: agentUser.agentProfile.serviceLatitude,
          longitude: agentUser.agentProfile.serviceLongitude
        };

  const { activeLoadByAgentId } = await getAgentRequestLoadStats(collection, [agentUser.id]);
  const remainingCapacityNgn = agentUser.agentProfile.dailyCapacityNgn - (activeLoadByAgentId.get(agentUser.id) ?? 0);

  return documents
    .filter((document) => document.estimatedLocalAmount <= remainingCapacityNgn)
    .sort((left, right) => {
      const leftDistance = calculateDistanceKm(
        ensureLivePresenceCoordinates(referenceCoordinates.latitude, referenceCoordinates.longitude),
        {
          latitude: left.pickupLatitude ?? resolvePickupLocation(left.pickupArea || left.pickupLocation).latitude,
          longitude: left.pickupLongitude ?? resolvePickupLocation(left.pickupArea || left.pickupLocation).longitude
        }
      );
      const rightDistance = calculateDistanceKm(
        ensureLivePresenceCoordinates(referenceCoordinates.latitude, referenceCoordinates.longitude),
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

  return documents.map(serializePayoutRequest);
}

export async function listReceiverPayoutRequests(receiverPhone: string) {
  const collection = await getPayoutRequestsCollection();
  const documents = await collection.find({ receiverPhone }).sort({ updatedAt: -1 }).toArray();
  return documents.map(serializePayoutRequest);
}

export async function getPayoutRequestById(requestId: string) {
  const collection = await getPayoutRequestsCollection();
  const document = await collection.findOne({ _id: ensureObjectId(requestId, "request id") });
  return document ? serializePayoutRequest(document) : null;
}

export async function getPayoutRequestByIdForUser(requestId: string, user: AppUser) {
  const collection = await getPayoutRequestsCollection();
  const document = await collection.findOne({ _id: ensureObjectId(requestId, "request id") });

  if (!document) {
    return null;
  }

  const isSender = document.senderUserId.toHexString() === user.id;
  const isReceiverByPhone = document.receiverPhone === user.phoneNumber;
  const isAssignedAgent = document.assignedAgent?.userId.toHexString() === user.id;
  const canViewOpenAgentRequest = Boolean(user.agentProfile && user.walletAddress && document.status === "open");

  if (!isSender && !isReceiverByPhone && !isAssignedAgent && !canViewOpenAgentRequest) {
    throw new Error("You do not have access to this request.");
  }

  return serializePayoutRequest(document);
}

export async function getLatestRelevantPayoutRequest(user: AppUser) {
  const collection = await getPayoutRequestsCollection();
  const filter = {
    $or: [
      { senderUserId: ensureObjectId(user.id, "sender user id") },
      { receiverPhone: user.phoneNumber },
      { "assignedAgent.userId": ensureObjectId(user.id, "agent user id") },
      ...(user.agentProfile && user.walletAddress ? [{ status: "open" as const }] : [])
    ]
  };

  const document = await collection
    .find(filter)
    .sort({
      updatedAt: -1
    })
    .limit(1)
    .next();

  return document ? serializePayoutRequest(document) : null;
}

export async function acceptPayoutRequest(input: { requestId: string; agentUser: AppUser }) {
  const collection = await getPayoutRequestsCollection();
  const _id = ensureObjectId(input.requestId, "request id");
  const document = await collection.findOne({ _id });

  if (!document) {
    throw new Error("Payout request not found.");
  }

  ensureStatusTransition(document.status, "open");
  const agentProfile = ensureAgentDispatchProfile(input.agentUser);
  const livePresence = await getFreshOnlineAgentPresenceByUserId(input.agentUser.id);
  const dispatchCoordinates =
    livePresence && typeof livePresence.latitude === "number" && typeof livePresence.longitude === "number"
      ? {
          latitude: livePresence.latitude,
          longitude: livePresence.longitude
        }
      : {
          latitude: agentProfile.serviceLatitude,
          longitude: agentProfile.serviceLongitude
        };

  const { activeLoadByAgentId, completedCountByAgentId } = await getAgentRequestLoadStats(collection, [input.agentUser.id]);
  const currentActiveLoad = activeLoadByAgentId.get(input.agentUser.id) ?? 0;

  if (agentProfile.dailyCapacityNgn - currentActiveLoad < document.estimatedLocalAmount) {
    throw new Error("This payout is above the remaining cash capacity for this agent.");
  }

  const resolvedPickupLocation = resolvePickupLocation(document.pickupArea || document.pickupLocation);
  const distanceKm = calculateDistanceKm(
    ensureLivePresenceCoordinates(dispatchCoordinates.latitude, dispatchCoordinates.longitude),
    {
      latitude: document.pickupLatitude ?? resolvedPickupLocation.latitude,
      longitude: document.pickupLongitude ?? resolvedPickupLocation.longitude
    }
  );
  const now = new Date();

  await collection.updateOne(
    { _id, status: "open" },
    {
      $set: {
        status: "accepted",
        assignedAgent: buildAssignedAgentSnapshot({
          agentUser: input.agentUser,
          acceptedAt: now,
          distanceKm,
          transferCount: completedCountByAgentId.get(input.agentUser.id) ?? 0
        }),
        updatedAt: now
      }
    }
  );

  const updatedDocument = await collection.findOne({ _id });

  if (!updatedDocument) {
    throw new Error("Failed to accept payout request.");
  }

  return serializePayoutRequest(updatedDocument);
}

export async function completePayoutRequest(input: { requestId: string; actorUser: AppUser }) {
  const collection = await getPayoutRequestsCollection();
  const _id = ensureObjectId(input.requestId, "request id");
  const document = await collection.findOne({ _id });

  if (!document) {
    throw new Error("Payout request not found.");
  }

  ensureStatusTransition(document.status, "accepted");

  const isAssignedAgent =
    input.actorUser.role === "agent" && document.assignedAgent?.userId.toHexString() === input.actorUser.id;
  const isSender = document.senderUserId.toHexString() === input.actorUser.id;
  const isReceiverByPhone = document.receiverPhone === input.actorUser.phoneNumber;

  if (!isAssignedAgent && !isSender && !isReceiverByPhone) {
    throw new Error("You do not have permission to complete this request.");
  }

  const now = new Date();

  await collection.updateOne(
    { _id, status: "accepted" },
    {
      $set: {
        status: "completed",
        completedAt: now,
        updatedAt: now
      }
    }
  );

  const updatedDocument = await collection.findOne({ _id });

  if (!updatedDocument) {
    throw new Error("Failed to complete payout request.");
  }

  return serializePayoutRequest(updatedDocument);
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

  const now = new Date();

  await collection.updateOne(
    { _id, status: "open" },
    {
      $set: {
        status: "cancelled",
        cancelledAt: now,
        updatedAt: now
      }
    }
  );

  const updatedDocument = await collection.findOne({ _id });

  if (!updatedDocument) {
    throw new Error("Failed to cancel payout request.");
  }

  return serializePayoutRequest(updatedDocument);
}
