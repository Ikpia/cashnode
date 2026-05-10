import { ObjectId, type Collection, type WithId } from "mongodb";
import { getMongoDb } from "@/lib/mongodb";

export const AGENT_PRESENCE_STALE_MS = 1000 * 180;

type AgentPresenceDocument = {
  userId: ObjectId;
  isOnline: boolean;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  source: "browser";
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt: Date;
  onlineSince?: Date;
  wentOfflineAt?: Date;
};

export type AppAgentPresence = {
  userId: string;
  isOnline: boolean;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  source: "browser";
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
  onlineSince: string | null;
  wentOfflineAt: string | null;
  stale: boolean;
};

const COLLECTION_NAME = "agent_presence";
let indexSetupPromise: Promise<void> | null = null;

function ensureObjectId(userId: string, label = "user id") {
  if (!ObjectId.isValid(userId)) {
    throw new Error(`Invalid ${label}.`);
  }

  return new ObjectId(userId);
}

function normalizeLatitude(value: unknown) {
  const latitude = Number(value);

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error("Latitude must be between -90 and 90.");
  }

  return latitude;
}

function normalizeLongitude(value: unknown) {
  const longitude = Number(value);

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error("Longitude must be between -180 and 180.");
  }

  return longitude;
}

function normalizeAccuracy(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const accuracy = Number(value);

  if (!Number.isFinite(accuracy) || accuracy < 0) {
    throw new Error("Accuracy must be a positive number.");
  }

  return Math.round(accuracy * 10) / 10;
}

function isPresenceStale(lastSeenAt: Date, isOnline: boolean) {
  return !isOnline || Date.now() - lastSeenAt.getTime() > AGENT_PRESENCE_STALE_MS;
}

function toAppAgentPresence(document: WithId<AgentPresenceDocument>): AppAgentPresence {
  return {
    userId: document.userId.toHexString(),
    isOnline: document.isOnline,
    latitude: typeof document.latitude === "number" ? document.latitude : null,
    longitude: typeof document.longitude === "number" ? document.longitude : null,
    accuracyMeters: typeof document.accuracyMeters === "number" ? document.accuracyMeters : null,
    source: document.source,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    lastSeenAt: document.lastSeenAt.toISOString(),
    onlineSince: document.onlineSince?.toISOString() ?? null,
    wentOfflineAt: document.wentOfflineAt?.toISOString() ?? null,
    stale: isPresenceStale(document.lastSeenAt, document.isOnline)
  };
}

async function getAgentPresenceCollection(): Promise<Collection<AgentPresenceDocument>> {
  const db = await getMongoDb();
  const collection = db.collection<AgentPresenceDocument>(COLLECTION_NAME);

  if (!indexSetupPromise) {
    indexSetupPromise = collection
      .createIndexes([
        { key: { userId: 1 }, name: "user_id_unique", unique: true },
        { key: { isOnline: 1, lastSeenAt: -1 }, name: "online_last_seen_lookup" }
      ])
      .then(() => undefined);
  }

  await indexSetupPromise;
  return collection;
}

export async function getAgentPresenceByUserId(userId: string) {
  const collection = await getAgentPresenceCollection();
  const document = await collection.findOne({
    userId: ensureObjectId(userId)
  });

  return document ? toAppAgentPresence(document) : null;
}

export async function getFreshOnlineAgentPresenceByUserId(userId: string) {
  const collection = await getAgentPresenceCollection();
  const cutoff = new Date(Date.now() - AGENT_PRESENCE_STALE_MS);
  const document = await collection.findOne({
    userId: ensureObjectId(userId),
    isOnline: true,
    lastSeenAt: { $gte: cutoff }
  });

  if (!document || typeof document.latitude !== "number" || typeof document.longitude !== "number") {
    return null;
  }

  return toAppAgentPresence(document);
}

export async function listFreshOnlineAgentPresenceMap(agentUserIds?: string[]) {
  const collection = await getAgentPresenceCollection();
  const cutoff = new Date(Date.now() - AGENT_PRESENCE_STALE_MS);
  const filter = {
    isOnline: true,
    lastSeenAt: { $gte: cutoff },
    ...(agentUserIds && agentUserIds.length > 0
      ? {
          userId: {
            $in: agentUserIds.map((agentUserId) => ensureObjectId(agentUserId))
          }
        }
      : {})
  };
  const documents = await collection.find(filter).toArray();

  return documents.reduce<Map<string, AppAgentPresence>>((presenceMap, document) => {
    if (typeof document.latitude === "number" && typeof document.longitude === "number") {
      presenceMap.set(document.userId.toHexString(), toAppAgentPresence(document));
    }

    return presenceMap;
  }, new Map<string, AppAgentPresence>());
}

export async function upsertAgentPresenceOnline(input: {
  userId: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
}) {
  const collection = await getAgentPresenceCollection();
  const userObjectId = ensureObjectId(input.userId);
  const latitude = normalizeLatitude(input.latitude);
  const longitude = normalizeLongitude(input.longitude);
  const accuracyMeters = normalizeAccuracy(input.accuracyMeters);
  const now = new Date();
  const existingDocument = await collection.findOne({ userId: userObjectId });
  const onlineSince = existingDocument?.isOnline ? existingDocument.onlineSince ?? existingDocument.lastSeenAt : now;

  await collection.updateOne(
    { userId: userObjectId },
    {
      $set: {
        isOnline: true,
        latitude,
        longitude,
        ...(accuracyMeters !== undefined ? { accuracyMeters } : {}),
        source: "browser",
        updatedAt: now,
        lastSeenAt: now,
        onlineSince
      },
      $setOnInsert: {
        createdAt: now
      },
      $unset: {
        wentOfflineAt: ""
      }
    },
    { upsert: true }
  );

  const updatedDocument = await collection.findOne({ userId: userObjectId });

  if (!updatedDocument) {
    throw new Error("Failed to update agent presence.");
  }

  return toAppAgentPresence(updatedDocument);
}

export async function markAgentPresenceOffline(userId: string) {
  const collection = await getAgentPresenceCollection();
  const userObjectId = ensureObjectId(userId);
  const now = new Date();

  await collection.updateOne(
    { userId: userObjectId },
    {
      $set: {
        isOnline: false,
        updatedAt: now,
        lastSeenAt: now,
        wentOfflineAt: now
      }
    },
    { upsert: false }
  );

  const updatedDocument = await collection.findOne({ userId: userObjectId });
  return updatedDocument ? toAppAgentPresence(updatedDocument) : null;
}
