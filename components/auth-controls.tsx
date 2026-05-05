"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { hasAgentCapability } from "@/lib/agent-capability";
import { authFetch, clearStoredAuthToken } from "@/lib/client-auth";

type SessionUser = {
  phoneNumber: string;
  role: "sender" | "agent" | "receiver";
  onboardingStatus: "new" | "onboarding" | "active";
  agentProfile: Record<string, unknown> | null;
};

function formatRoleLabel(user: SessionUser) {
  if (hasAgentCapability(user)) {
    return "POS Agent";
  }

  const role = user.role;

  if (role === "agent") {
    return "POS Agent";
  }

  if (role === "receiver") {
    return "Receiver";
  }

  return "Sender";
}

const SESSION_CACHE_KEY = "cashnode_session_cache";
const SESSION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function readCachedUser(): SessionUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    const { user, expiresAt } = JSON.parse(raw) as { user: SessionUser | null; expiresAt: number };
    if (Date.now() > expiresAt) {
      sessionStorage.removeItem(SESSION_CACHE_KEY);
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

function writeCachedUser(user: SessionUser | null) {
  try {
    sessionStorage.setItem(
      SESSION_CACHE_KEY,
      JSON.stringify({ user, expiresAt: Date.now() + SESSION_CACHE_TTL_MS })
    );
  } catch {
    // sessionStorage unavailable — ignore
  }
}

function clearCachedUser() {
  try {
    sessionStorage.removeItem(SESSION_CACHE_KEY);
  } catch {
    // ignore
  }
}

export function AuthControls() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    // Show cached user immediately to avoid the "Checking session..." flash
    const cached = readCachedUser();
    if (cached !== null) {
      setUser(cached);
      setIsLoading(false);
      return; // skip network round-trip until cache expires
    }

    const loadSession = async () => {
      try {
        const response = await authFetch("/api/auth/session", {
          method: "GET",
          cache: "no-store"
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load auth session.");
        }

        const sessionUser: SessionUser | null = payload.user ?? null;
        writeCachedUser(sessionUser);
        setUser(sessionUser);
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    void loadSession();
  }, []);

  const handleSignOut = async () => {
    setIsSigningOut(true);

    try {
      await authFetch("/api/auth/session", {
        method: "DELETE"
      });
    } finally {
      clearStoredAuthToken();
      clearCachedUser();
      setUser(null);
      setIsSigningOut(false);
      router.push("/auth");
      router.refresh();
    }
  };

  if (isLoading) {
    return <div className="text-sm text-stone-400">Checking session...</div>;
  }

  if (!user) {
    return (
      <Link
        href="/auth"
        className="rounded-full border border-stone-200 bg-white px-5 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-stone-50"
      >
        Sign In
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right md:block">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">{formatRoleLabel(user)}</div>
        <div className="text-sm font-medium text-stone-700">{user.phoneNumber}</div>
      </div>
      <button
        type="button"
        onClick={() => void handleSignOut()}
        className="rounded-full border border-stone-200 bg-white px-5 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-stone-50"
      >
        {isSigningOut ? "Signing out..." : "Sign Out"}
      </button>
    </div>
  );
}
