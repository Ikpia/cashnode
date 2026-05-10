import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth-session";
import { getSenderOnboardingRecord, saveSenderBasics } from "@/lib/sender-onboarding";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const onboardingId = searchParams.get("onboardingId");

    if (!onboardingId) {
      return NextResponse.json({ error: "onboardingId is required." }, { status: 400 });
    }

    const record = await getSenderOnboardingRecord(onboardingId);

    if (!record) {
      return NextResponse.json({ error: "Sender onboarding record not found." }, { status: 404 });
    }

    if (record.mobileNumber !== user.phoneNumber) {
      return NextResponse.json({ error: "You do not have access to this sender onboarding record." }, { status: 403 });
    }

    return NextResponse.json({ record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load sender onboarding record.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (typeof body.onboardingId === "string" && body.onboardingId.trim()) {
      const existingRecord = await getSenderOnboardingRecord(body.onboardingId.trim());

      if (existingRecord && existingRecord.mobileNumber !== user.phoneNumber) {
        return NextResponse.json({ error: "You do not have access to this sender onboarding record." }, { status: 403 });
      }
    }

    const record = await saveSenderBasics({
      onboardingId: body.onboardingId,
      fullName: body.fullName,
      mobileNumber: user.phoneNumber,
      country: body.country,
      corridor: body.corridor
    });

    return NextResponse.json({ record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save sender onboarding basics.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
