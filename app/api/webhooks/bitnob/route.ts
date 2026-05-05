import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { applyBitnobPayoutWebhook } from "@/lib/payout-requests";
import { beginWebhookEvent, completeWebhookEvent, failWebhookEvent } from "@/lib/webhook-events";

export const runtime = "nodejs";

function safeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function validateBitnobSignature(rawBody: string, signatureHeader: string) {
  const secretKey = process.env.BITNOB_SECRET_KEY?.trim();

  if (!secretKey) {
    throw new Error("BITNOB_SECRET_KEY is missing.");
  }

  const expectedHex = createHmac("sha512", secretKey).update(rawBody).digest("hex");
  const expectedBase64 = createHmac("sha512", secretKey).update(rawBody).digest("base64");
  const normalizedHeader = signatureHeader.trim();

  return safeEquals(expectedHex, normalizedHeader.toLowerCase()) || safeEquals(expectedBase64, normalizedHeader);
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
  const externalEventIdCandidates = [eventRecord.id, dataRecord.id, dataRecord.reference, eventRecord.reference];
  const externalEventId =
    externalEventIdCandidates.find((value) => typeof value === "string" && value.trim())?.toString().trim() ?? "";

  return {
    eventName,
    externalEventId
  };
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-bitnob-signature")?.trim() ?? "";

  if (!signatureHeader) {
    return NextResponse.json({ error: "Missing x-bitnob-signature header." }, { status: 401 });
  }

  if (!validateBitnobSignature(rawBody, signatureHeader)) {
    return NextResponse.json({ error: "Invalid Bitnob signature." }, { status: 401 });
  }

  let payload: unknown = null;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const meta = extractPayloadMeta(payload);
  const lock = await beginWebhookEvent({
    provider: "bitnob",
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
    const result = await applyBitnobPayoutWebhook(payload);
    await completeWebhookEvent({
      eventLogId: lock.eventLogId,
      status: result.matchedRequest ? "processed" : "ignored",
      processingResult: result
    });

    return NextResponse.json({ ok: true, duplicate: false }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process Bitnob webhook.";

    await failWebhookEvent({
      eventLogId: lock.eventLogId,
      errorMessage: message
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
