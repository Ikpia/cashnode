import type { AppUser } from "@/lib/users";

function isGeneratedRoleName(value: string) {
  return /\b(Sender|Agent|Receiver)\b/i.test(value);
}

function normalizeNameParts(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function getUserFirstName(user: Pick<AppUser, "displayName" | "agentProfile">) {
  const primaryName = user.agentProfile?.ownerName?.trim() || user.displayName.trim();

  if (!primaryName || isGeneratedRoleName(primaryName)) {
    return null;
  }

  const [firstName] = normalizeNameParts(primaryName);
  return firstName || null;
}

export function getWelcomeGreeting(user: Pick<AppUser, "displayName" | "agentProfile">, fallback: string) {
  const firstName = getUserFirstName(user);
  return firstName ? `Welcome back, ${firstName}.` : fallback;
}
