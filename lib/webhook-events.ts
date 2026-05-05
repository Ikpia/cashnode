import { createHash } from "node:crypto";
import { MongoServerError, ObjectId, type Collection } from "mongodb";
import { getMongoDb } from "@/lib/mongodb";

export type WebhookProvider = "paystack" | "bitnob";
export type WebhookEventStatus = "processing" | "processed" | "ignored" | "failed";

type WebhookEventDocument = {
  provider: WebhookProvider;
  idempotencyKey: string;
  eventName: string;
  externalEventId?: string;
  signature: string;
  payloadHash: string;
  payload: unknown;
  status: WebhookEventStatus;
  processingError?: string;
  processingResult?: Record<string, unknown>;
  createdAt: Date;
  processedAt?: Date;
  updatedAt: Date;
};

const COLLECTION_NAME = "webhook_events";
let indexSetupPromise: Promise<void> | null = null;

function hashPayload(rawBody: string) {
  return createHash("sha256").update(rawBody).digest("hex");
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

async function getCollection(): Promise<Collection<WebhookEventDocument>> {
  const db = await getMongoDb();
  const collection = db.collection<WebhookEventDocument>(COLLECTION_NAME);

  if (!indexSetupPromise) {
    indexSetupPromise = collection
      .createIndexes([
        { key: { idempotencyKey: 1 }, name: "idempotency_key_unique", unique: true },
        { key: { provider: 1, createdAt: -1 }, name: "provider_created_lookup" },
        { key: { status: 1, updatedAt: -1 }, name: "status_updated_lookup" }
      ])
      .then(() => undefined);
  }

  await indexSetupPromise;
  return collection;
}

export async function beginWebhookEvent(input: {
  provider: WebhookProvider;
  eventName: string;
  rawBody: string;
  payload: unknown;
  signature: string;
  externalEventId?: string;
}) {
  const collection = await getCollection();
  const now = new Date();
  const payloadHash = hashPayload(input.rawBody);
  const externalEventId = normalizeText(input.externalEventId);
  const keyPart = externalEventId || payloadHash;
  const idempotencyKey = `${input.provider}:${keyPart}`;

  try {
    const insertResult = await collection.insertOne({
      provider: input.provider,
      idempotencyKey,
      eventName: input.eventName,
      externalEventId: externalEventId || undefined,
      signature: input.signature,
      payloadHash,
      payload: input.payload,
      status: "processing",
      createdAt: now,
      updatedAt: now
    });

    return {
      duplicate: false,
      eventLogId: insertResult.insertedId.toHexString()
    };
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      return {
        duplicate: true,
        eventLogId: null
      };
    }

    throw error;
  }
}

function ensureObjectId(value: string) {
  if (!ObjectId.isValid(value)) {
    throw new Error("Invalid webhook event log id.");
  }

  return new ObjectId(value);
}

export async function completeWebhookEvent(input: {
  eventLogId: string;
  status: Extract<WebhookEventStatus, "processed" | "ignored">;
  processingResult?: Record<string, unknown>;
}) {
  const collection = await getCollection();
  const now = new Date();

  await collection.updateOne(
    { _id: ensureObjectId(input.eventLogId) },
    {
      $set: {
        status: input.status,
        processingResult: input.processingResult ?? {},
        updatedAt: now,
        processedAt: now
      }
    }
  );
}

export async function failWebhookEvent(input: { eventLogId: string; errorMessage: string }) {
  const collection = await getCollection();
  const now = new Date();

  await collection.updateOne(
    { _id: ensureObjectId(input.eventLogId) },
    {
      $set: {
        status: "failed",
        processingError: input.errorMessage,
        updatedAt: now
      }
    }
  );
}
