import { NextResponse } from "next/server";
import { saveSenderFunding } from "@/lib/sender-onboarding";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

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
