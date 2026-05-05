import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { applyPaystackTransferWebhook } from "@/lib/payout-requests";
import { beginWebhookEvent, completeWebhookEvent, failWebhookEvent } from "@/lib/webhook-events";

export const runtime = "nodejs";

function normalizeHex(value: string) {
  return value.trim().toLowerCase();
}

function validatePaystackSignature(rawBody: string, signatureHeader: string) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim();

  if (!secretKey) {
    throw new Error("PAYSTACK_SECRET_KEY is missing.");
  }

  const expectedHex = createHmac("sha512", secretKey).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(normalizeHex(expectedHex), "utf8");
  const providedBuffer = Buffer.from(normalizeHex(signatureHeader), "utf8");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

function extractPayloadMeta(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return {
      eventName: "unknown",
      externalEventId: ""
    };
  }

  const eventRecord = payload as Record<string, unknown>;
  const dataRecord = eventRecord.data && typeof eventRecord.data === "object" ? (eventRecord.data as Record<string, unknown>) : {};

  const eventName = typeof eventRecord.event === "string" && eventRecord.event.trim() ? eventRecord.event.trim() : "unknown";
  const externalEventIdCandidates = [eventRecord.id, dataRecord.id, dataRecord.reference];
  const externalEventId =
    externalEventIdCandidates.find((value) => typeof value === "string" && value.trim())?.toString().trim() ?? "";

  return {
    eventName,
    externalEventId
  };
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-paystack-signature")?.trim() ?? "";

  if (!signatureHeader) {
    return NextResponse.json({ error: "Missing x-paystack-signature header." }, { status: 401 });
  }

  if (!validatePaystackSignature(rawBody, signatureHeader)) {
    return NextResponse.json({ error: "Invalid Paystack signature." }, { status: 401 });
  }

  let payload: unknown = null;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const meta = extractPayloadMeta(payload);
  const lock = await beginWebhookEvent({
    provider: "paystack",
    eventName: meta.eventName,
    rawBody,
    payload,
    signature: signatureHeader,
    externalEventId: meta.externalEventId
  });

  if (lock.duplicate) {
    return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
  }

  if (!lock.eventLogId) {
    return NextResponse.json({ error: "Failed to create webhook event log." }, { status: 500 });
  }

  try {
    const result = await applyPaystackTransferWebhook(payload);
    await completeWebhookEvent({
      eventLogId: lock.eventLogId,
      status: result.matchedRequest ? "processed" : "ignored",
      processingResult: result
    });

    return NextResponse.json({ ok: true, duplicate: false }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process Paystack webhook.";

    await failWebhookEvent({
      eventLogId: lock.eventLogId,
      errorMessage: message
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
