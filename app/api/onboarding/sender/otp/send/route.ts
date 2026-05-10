import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth-session";
import { getSenderOnboardingRecord, markSenderOtpSent } from "@/lib/sender-onboarding";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (typeof body.onboardingId !== "string" || !body.onboardingId.trim()) {
      return NextResponse.json({ error: "onboardingId is required." }, { status: 400 });
    }

    const existingRecord = await getSenderOnboardingRecord(body.onboardingId.trim());

    if (!existingRecord) {
      return NextResponse.json({ error: "Sender onboarding record not found." }, { status: 404 });
    }

    if (existingRecord.mobileNumber !== user.phoneNumber) {
      return NextResponse.json({ error: "You do not have access to this sender onboarding record." }, { status: 403 });
    }

    const record = await markSenderOtpSent(body.onboardingId.trim());

    return NextResponse.json({
      message: "Firebase phone challenge started successfully.",
      record
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send OTP.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
