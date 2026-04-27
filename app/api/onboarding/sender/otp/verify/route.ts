import { NextResponse } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/firebase-admin";
import { verifySenderPhoneWithFirebase } from "@/lib/sender-onboarding";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const idToken = typeof body.idToken === "string" ? body.idToken.trim() : "";

    if (!idToken) {
      return NextResponse.json({ error: "idToken is required." }, { status: 400 });
    }

    const decodedToken = await getFirebaseAdminAuth().verifyIdToken(idToken);

    if (!decodedToken.phone_number) {
      return NextResponse.json({ error: "Verified Firebase user is missing a phone number." }, { status: 400 });
    }

    const record = await verifySenderPhoneWithFirebase({
      onboardingId: body.onboardingId,
      firebaseUid: decodedToken.uid,
      verifiedPhoneNumber: decodedToken.phone_number
    });

    return NextResponse.json({
      message: "Firebase phone verification saved successfully.",
      record
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to verify OTP.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
