import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth-session";
import { getSenderOnboardingRecord, saveSenderFunding } from "@/lib/sender-onboarding";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const existingRecord = await getSenderOnboardingRecord(body.onboardingId);

    if (!existingRecord) {
      return NextResponse.json({ error: "Sender onboarding record not found." }, { status: 404 });
    }

    if (existingRecord.mobileNumber !== user.phoneNumber) {
      return NextResponse.json({ error: "You do not have access to this sender onboarding record." }, { status: 403 });
    }

    const record = await saveSenderFunding({
      onboardingId: body.onboardingId,
      rail: body.rail,
      walletNote: body.walletNote
    });

    return NextResponse.json({
      message: "Funding details saved successfully.",
      record
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save funding details.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
