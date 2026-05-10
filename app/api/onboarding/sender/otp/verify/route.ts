import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth-session";
import { getFirebaseAdminAuth } from "@/lib/firebase-admin";
import { getSenderOnboardingRecord, verifySenderPhoneWithFirebase } from "@/lib/sender-onboarding";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

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

    if (decodedToken.phone_number !== user.phoneNumber) {
      return NextResponse.json({ error: "Verified phone number does not match the current session." }, { status: 403 });
    }

    const existingRecord = await getSenderOnboardingRecord(body.onboardingId);

    if (!existingRecord) {
      return NextResponse.json({ error: "Sender onboarding record not found." }, { status: 404 });
    }

    if (existingRecord.mobileNumber !== user.phoneNumber) {
      return NextResponse.json({ error: "You do not have access to this sender onboarding record." }, { status: 403 });
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
