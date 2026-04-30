import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  clearSessionByCookieToken,
  createSessionForUser,
  getCurrentSessionUser,
  getUserEntryPath,
  SESSION_COOKIE_NAME,
  SESSION_EXPIRES_IN_MS
} from "@/lib/auth-session";
import { authenticateWithPin, signupWithWhatsAppPin } from "@/lib/local-auth";
import { getUserFirstName } from "@/lib/user-greeting";

export const runtime = "nodejs";

type SignupBody = {
  action: "signup";
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  whatsappCode?: string;
  pin?: string;
};

type LoginBody = {
  action: "login";
  identifier?: string;
  pin?: string;
};

type SessionBody = SignupBody | LoginBody;

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
    const body = (await request.json()) as SessionBody;

    if (body.action !== "signup" && body.action !== "login") {
      return NextResponse.json({ error: "A valid auth action is required." }, { status: 400 });
    }

    const user =
      body.action === "signup"
        ? await signupWithWhatsAppPin({
            fullName: body.fullName,
            email: body.email,
            phoneNumber: body.phoneNumber,
            whatsappCode: body.whatsappCode,
            pin: body.pin
          })
        : await authenticateWithPin({
            identifier: body.identifier,
            pin: body.pin
          });
    const sessionToken = await createSessionForUser(user.id);
    const response = NextResponse.json({
      authenticated: true,
      token: sessionToken,
      user: {
        ...user,
        firstName: getUserFirstName(user)
      },
      redirectPath: getUserEntryPath(user)
    });

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_EXPIRES_IN_MS / 1000
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to authenticate right now.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? "";

  if (sessionCookie) {
    await clearSessionByCookieToken(sessionCookie);
  }

  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });

  return response;
}
