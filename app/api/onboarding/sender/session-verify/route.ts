import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth-session";
import { verifySenderPhoneWithFirebase } from "@/lib/sender-onboarding";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentSessionUser();

  if (!user || user.role !== "sender") {
    return NextResponse.json({ error: "Only signed-in senders can confirm sender verification." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const record = await verifySenderPhoneWithFirebase({
      onboardingId: body.onboardingId,
      firebaseUid: user.firebaseUid,
      verifiedPhoneNumber: user.phoneNumber
    });

    return NextResponse.json({
      message: "Sender session verified successfully.",
      record
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to confirm sender verification.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
