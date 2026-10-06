let currentUser = null;

export function __setCurrentSessionUser(user) {
  currentUser = user;
}

export function __resetAuthSession() {
  currentUser = null;
}

export async function getCurrentSessionUser() {
  return currentUser;
}

export async function requireSignedInUser() {
  if (!currentUser) {
    throw new Error("Unauthorized.");
  }

  return currentUser;
}

export const SESSION_COOKIE_NAME = "cashnode_session";
export const SESSION_EXPIRES_IN_MS = 1000 * 60 * 60 * 24 * 5;
