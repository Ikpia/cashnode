import { NextResponse } from "next/server";
import { getSenderOnboardingRecord, saveSenderBasics } from "@/lib/sender-onboarding";

export const runtime = "nodejs";

export async function GET(request: Request) {
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

    return NextResponse.json({ record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load sender onboarding record.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const record = await saveSenderBasics({
      onboardingId: body.onboardingId,
      fullName: body.fullName,
      mobileNumber: body.mobileNumber,
      country: body.country,
      corridor: body.corridor
    });

    return NextResponse.json({ record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save sender onboarding basics.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
