import { NextResponse } from "next/server";
import { markSenderOtpSent } from "@/lib/sender-onboarding";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (typeof body.onboardingId !== "string" || !body.onboardingId.trim()) {
      return NextResponse.json({ error: "onboardingId is required." }, { status: 400 });
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
