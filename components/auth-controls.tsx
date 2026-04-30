"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, clearStoredAuthToken } from "@/lib/client-auth";

type SessionUser = {
  phoneNumber: string;
  role: "sender" | "agent" | "receiver";
};

function formatRoleLabel(role: SessionUser["role"]) {
  if (role === "agent") {
    return "POS Agent";
  }

  if (role === "receiver") {
    return "Receiver";
  }

  return "Sender";
}

export function AuthControls() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
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

        setUser(payload.user ?? null);
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
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">{formatRoleLabel(user.role)}</div>
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
