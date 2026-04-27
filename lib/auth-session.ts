import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getFirebaseAdminAuth } from "@/lib/firebase-admin";
import { getUserByFirebaseUid, type AppUser, type OnboardingStatus, type UserRole } from "@/lib/users";

export const SESSION_COOKIE_NAME = "cashnode_session";
export const SESSION_EXPIRES_IN_MS = 1000 * 60 * 60 * 24 * 5;

export function getRoleHomePath(role: UserRole) {
  switch (role) {
    case "agent":
      return "/agent-dashboard";
    case "receiver":
      return "/receiver-portal";
    default:
      return "/sender-dashboard";
  }
}

export function getRoleOnboardingPath(role: UserRole) {
  switch (role) {
    case "agent":
      return "/onboarding/agent";
    case "receiver":
      return "/onboarding/receiver";
    default:
      return "/onboarding/sender";
  }
}

export function getUserEntryPath(user: Pick<AppUser, "role" | "onboardingStatus">) {
  return user.onboardingStatus === "active" ? getRoleHomePath(user.role) : getRoleOnboardingPath(user.role);
}

export function getEntryPathForRole(role: UserRole, onboardingStatus: OnboardingStatus = "active") {
  return onboardingStatus === "active" ? getRoleHomePath(role) : getRoleOnboardingPath(role);
}

export async function getCurrentSessionUser(): Promise<AppUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return null;
  }

  try {
    const decodedToken = await getFirebaseAdminAuth().verifySessionCookie(sessionCookie, false);
    return await getUserByFirebaseUid(decodedToken.uid);
  } catch {
    return null;
  }
}

export async function requireSignedInUser() {
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser) {
    redirect("/auth");
  }

  return sessionUser;
}

export async function requireUserRole(role: UserRole) {
  const sessionUser = await requireSignedInUser();

  if (sessionUser.onboardingStatus !== "active") {
    redirect(getRoleOnboardingPath(sessionUser.role));
  }

  if (sessionUser.role !== role) {
    redirect(getUserEntryPath(sessionUser));
  }

  return sessionUser;
}
