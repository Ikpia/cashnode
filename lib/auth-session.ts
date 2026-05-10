import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { clearLocalSession, createLocalSession, getUserFromLocalSession } from "@/lib/local-auth";
import { type AppUser, type OnboardingStatus, type UserRole } from "@/lib/users";

export const SESSION_COOKIE_NAME = "cashnode_session";
export const ADMIN_ACCESS_COOKIE_NAME = "cashnode_admin_access";
export const SESSION_EXPIRES_IN_MS = 1000 * 60 * 60 * 24 * 5;
export const ADMIN_ACCESS_EXPIRES_IN_MS = 1000 * 60 * 60 * 8;

export function getRoleHomePath(role: UserRole) {
  if (role === "agent") {
    return "/dashboard";
  }

  return "/dashboard";
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

function parseAdminEnvList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizePhoneForAdminCheck(phoneNumber: string | null | undefined) {
  return phoneNumber?.replace(/\D/g, "") ?? "";
}

export function isAdminUser(user: Pick<AppUser, "id" | "phoneNumber">) {
  const adminUserIds = parseAdminEnvList(process.env.CASHNODE_ADMIN_USER_IDS);
  const adminPhoneNumbers = parseAdminEnvList(process.env.CASHNODE_ADMIN_PHONE_NUMBERS).map(normalizePhoneForAdminCheck);
  const userPhoneNumber = normalizePhoneForAdminCheck(user.phoneNumber);

  return adminUserIds.includes(user.id) || Boolean(userPhoneNumber && adminPhoneNumbers.includes(userPhoneNumber));
}

function getAdminAccessKey() {
  return process.env.CASHNODE_ADMIN_ACCESS_KEY?.trim() || process.env.CASHNODE_ADMIN_KEY?.trim() || "";
}

function getAdminAccessToken() {
  const adminAccessKey = getAdminAccessKey();

  if (!adminAccessKey) {
    return "";
  }

  return createHmac("sha256", adminAccessKey).update("cashnode-admin-access:v1").digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function isAdminAccessKeyConfigured() {
  return Boolean(getAdminAccessKey());
}

export async function hasAdminKeyAccess() {
  const expectedToken = getAdminAccessToken();

  if (!expectedToken) {
    return false;
  }

  const cookieStore = await cookies();
  const adminAccessToken = cookieStore.get(ADMIN_ACCESS_COOKIE_NAME)?.value ?? "";
  return Boolean(adminAccessToken && safeEqual(adminAccessToken, expectedToken));
}

export async function hasAdminAccess(user: Pick<AppUser, "id" | "phoneNumber">) {
  return isAdminUser(user) || (await hasAdminKeyAccess());
}

export async function grantAdminKeyAccess(adminKeyInput: unknown) {
  const expectedKey = getAdminAccessKey();
  const adminKey = typeof adminKeyInput === "string" ? adminKeyInput.trim() : "";

  if (!expectedKey) {
    throw new Error("Admin key access is not configured.");
  }

  if (!adminKey || !safeEqual(adminKey, expectedKey)) {
    throw new Error("Invalid admin key.");
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_ACCESS_COOKIE_NAME, getAdminAccessToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: Math.floor(ADMIN_ACCESS_EXPIRES_IN_MS / 1000)
  });
}

export async function getCurrentSessionUser(): Promise<AppUser | null> {
  const headerStore = await headers();
  const authorizationHeader = headerStore.get("authorization") ?? "";
  const bearerToken = authorizationHeader.toLowerCase().startsWith("bearer ")
    ? authorizationHeader.slice(7).trim()
    : "";

  if (bearerToken) {
    try {
      return await getUserFromLocalSession(bearerToken);
    } catch {
      // fall through to cookie compatibility
    }
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return null;
  }

  try {
    return await getUserFromLocalSession(sessionCookie);
  } catch {
    return null;
  }
}

export async function createSessionForUser(userId: string) {
  return createLocalSession(userId, SESSION_EXPIRES_IN_MS);
}

export async function clearSessionByCookieToken(sessionToken: string) {
  return clearLocalSession(sessionToken);
}

export async function requireSignedInUser() {
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser) {
    redirect("/auth");
  }

  return sessionUser;
}

export async function requireAdminUser() {
  const sessionUser = await requireSignedInUser();

  if (!(await hasAdminAccess(sessionUser))) {
    redirect("/dashboard");
  }

  return sessionUser;
}

export async function requireUserRole(role: UserRole) {
  const sessionUser = await requireSignedInUser();

  if (role === "agent") {
    if (sessionUser.onboardingStatus !== "active" || !sessionUser.agentProfile) {
      redirect("/onboarding/agent");
    }

    return sessionUser;
  }

  if (sessionUser.role !== role) {
    redirect(getRoleOnboardingPath(role));
  }

  return sessionUser;
}
