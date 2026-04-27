import { NextResponse } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/firebase-admin";
import { getCurrentSessionUser, getUserEntryPath, SESSION_COOKIE_NAME, SESSION_EXPIRES_IN_MS } from "@/lib/auth-session";
import { getUserFirstName } from "@/lib/user-greeting";
import { upsertUserFromFirebaseLogin } from "@/lib/users";

export const runtime = "nodejs";

type LoginRequestBody = {
  idToken?: string;
  role?: "sender" | "agent" | "receiver";
};

export async function GET() {
  const user = await getCurrentSessionUser();

  return NextResponse.json({
    authenticated: Boolean(user),
    user: user
      ? {
          ...user,
          firstName: getUserFirstName(user)
        }
      : null,
    redirectPath: user ? getUserEntryPath(user) : null
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginRequestBody;
    const idToken = typeof body.idToken === "string" ? body.idToken.trim() : "";

    if (!idToken) {
      return NextResponse.json({ error: "idToken is required." }, { status: 400 });
    }

    if (body.role !== "sender" && body.role !== "agent" && body.role !== "receiver") {
      return NextResponse.json({ error: "A valid role is required." }, { status: 400 });
    }

    const decodedToken = await getFirebaseAdminAuth().verifyIdToken(idToken);

    if (!decodedToken.phone_number) {
      return NextResponse.json({ error: "Firebase login is missing a verified phone number." }, { status: 400 });
    }

    const user = await upsertUserFromFirebaseLogin({
      firebaseUid: decodedToken.uid,
      phoneNumber: decodedToken.phone_number,
      requestedRole: body.role
    });

    const sessionCookie = await getFirebaseAdminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRES_IN_MS
    });

    const response = NextResponse.json({
      authenticated: true,
      user: {
        ...user,
        firstName: getUserFirstName(user)
      },
      redirectPath: getUserEntryPath(user)
    });

    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_EXPIRES_IN_MS / 1000
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create the auth session.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });

  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });

  return response;
}
