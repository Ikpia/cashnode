"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { hasAgentCapability } from "@/lib/agent-capability";
import { authFetch } from "@/lib/client-auth";
import type { AppAgentPresence } from "@/lib/agent-presence";

type CoordinatesSnapshot = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
};

type SessionUser = {
  id: string;
  role: "sender" | "agent" | "receiver";
  onboardingStatus: "new" | "onboarding" | "active";
  agentProfile: Record<string, unknown> | null;
};

type AgentPresenceRuntimeContextValue = {
  isAgentSession: boolean;
  isLoading: boolean;
  isUpdating: boolean;
  isLive: boolean;
  presence: AppAgentPresence | null;
  message: string;
  goLive: () => Promise<void>;
  goOffline: () => Promise<void>;
};

const agentPresencePreferenceKey = "cashnode_agent_live_dispatch_enabled";
const heartbeatIntervalMs = 45000;
const minimumSendGapMs = 15000;

const AgentPresenceRuntimeContext = createContext<AgentPresenceRuntimeContextValue | null>(null);

function readEnabledPreference() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(agentPresencePreferenceKey) === "1";
}

function writeEnabledPreference(enabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  if (enabled) {
    window.localStorage.setItem(agentPresencePreferenceKey, "1");
    return;
  }

  window.localStorage.removeItem(agentPresencePreferenceKey);
}

function normalizeGeolocationErrorMessage(error: unknown) {
  const geolocationErrorCode =
    typeof error === "object" && error && "code" in error && typeof error.code === "number" ? error.code : null;
  const geolocationErrorMessage =
    typeof error === "object" && error && "message" in error && typeof error.message === "string" ? error.message : "";

  if (geolocationErrorCode === 1) {
    return "Location access was denied. Allow location access to receive nearby payout matches.";
  }

  return geolocationErrorMessage || "Unable to update live dispatch right now.";
}

export function AgentPresenceRuntimeProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [presence, setPresence] = useState<AppAgentPresence | null>(null);
  const [message, setMessage] = useState("Go live to let CashNode match nearby receiver pickups using your current device location.");
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAgentSession, setIsAgentSession] = useState(false);
  const agentSessionRef = useRef(false);
  const enabledRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const lastKnownCoordinatesRef = useRef<CoordinatesSnapshot | null>(null);
  const lastSentAtRef = useRef(0);
  const lastRefreshAtRef = useRef(0);

  const isLive = Boolean(presence?.isOnline && !presence.stale);

  const clearHeartbeatTimer = () => {
    if (heartbeatTimerRef.current !== null) {
      window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  };

  const stopWatching = () => {
    if (watchIdRef.current !== null && typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = null;
  };

  const teardownRuntime = () => {
    stopWatching();
    clearHeartbeatTimer();
    enabledRef.current = false;
    lastKnownCoordinatesRef.current = null;
    setPresence(null);
  };

  const maybeRefreshCurrentRoute = (force = false) => {
    const now = Date.now();

    if (!force && now - lastRefreshAtRef.current < 60000) {
      return;
    }

    lastRefreshAtRef.current = now;
    router.refresh();
  };

  const pushPresenceHeartbeat = async (
    coordinates: CoordinatesSnapshot,
    options: {
      forceRefresh?: boolean;
      keepalive?: boolean;
      silent?: boolean;
    } = {}
  ) => {
    lastKnownCoordinatesRef.current = coordinates;
    lastSentAtRef.current = Date.now();

    const response = await authFetch("/api/agent-presence", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(coordinates),
      keepalive: options.keepalive
    });
    const payload = (await response.json()) as {
      error?: string;
      presence?: AppAgentPresence | null;
    };

    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to update live agent presence.");
    }

    if (payload.presence) {
      setPresence(payload.presence);
    }

    if (!options.silent) {
      setMessage("Live dispatch is active. CashNode is matching nearby receiver pickups using your current device location.");
    }

    maybeRefreshCurrentRoute(options.forceRefresh);
  };

  const refreshCurrentLocation = async (
    options: {
      forceRefresh?: boolean;
      maximumAge?: number;
      silent?: boolean;
    } = {}
  ) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      throw new Error("This browser does not support device geolocation, so live dispatch cannot start here.");
    }

    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: options.maximumAge ?? 0
      });
    });

    await pushPresenceHeartbeat(
      {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy
      },
      {
        forceRefresh: options.forceRefresh,
        silent: options.silent
      }
    );
  };

  const ensureHeartbeatTimer = () => {
    if (heartbeatTimerRef.current !== null) {
      return;
    }

    heartbeatTimerRef.current = window.setInterval(() => {
      const coordinates = lastKnownCoordinatesRef.current;

      if (!enabledRef.current || !coordinates) {
        return;
      }

      void pushPresenceHeartbeat(coordinates, { silent: true }).catch((error) => {
        setMessage(error instanceof Error ? error.message : "Unable to keep the live agent presence active.");
      });
    }, heartbeatIntervalMs);
  };

  const ensureGeolocationWatch = () => {
    if (watchIdRef.current !== null || typeof navigator === "undefined" || !("geolocation" in navigator)) {
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();

        if (now - lastSentAtRef.current < minimumSendGapMs) {
          return;
        }

        void pushPresenceHeartbeat(
          {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy
          },
          { silent: true }
        ).catch((error) => {
          setMessage(error instanceof Error ? error.message : "Unable to refresh live agent presence.");
        });
      },
      (error) => {
        setMessage(normalizeGeolocationErrorMessage(error));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 15000
      }
    );
  };

  const startLiveDispatch = async (resume = false) => {
    if (!agentSessionRef.current) {
      return;
    }

    setIsUpdating(true);
    enabledRef.current = true;
    writeEnabledPreference(true);

    try {
      await refreshCurrentLocation({
        forceRefresh: true,
        silent: resume
      });
      ensureGeolocationWatch();
      ensureHeartbeatTimer();

      if (!resume) {
        setMessage("Live dispatch is active. CashNode will keep using your current device location while you stay online.");
      }
    } catch (error) {
      enabledRef.current = false;
      writeEnabledPreference(false);
      setMessage(normalizeGeolocationErrorMessage(error));
    } finally {
      setIsUpdating(false);
    }
  };

  const stopLiveDispatch = async () => {
    if (!agentSessionRef.current) {
      return;
    }

    stopWatching();
    clearHeartbeatTimer();
    enabledRef.current = false;
    writeEnabledPreference(false);
    setIsUpdating(true);

    try {
      const response = await authFetch("/api/agent-presence", {
        method: "DELETE"
      });
      const payload = (await response.json()) as {
        error?: string;
        presence?: AppAgentPresence | null;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to stop live dispatch.");
      }

      setPresence(payload.presence ?? null);
      setMessage("You are offline. New payouts will no longer be matched to your live location until you go live again.");
      maybeRefreshCurrentRoute(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to stop live dispatch.");
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    const hydrateRuntime = async () => {
      try {
        const sessionResponse = await authFetch("/api/auth/session", {
          method: "GET",
          cache: "no-store"
        });
        const sessionPayload = (await sessionResponse.json()) as {
          authenticated?: boolean;
          user?: SessionUser | null;
        };

        const sessionUser = sessionPayload.user ?? null;
        const nextIsAgentSession = Boolean(sessionPayload.authenticated && hasAgentCapability(sessionUser));

        agentSessionRef.current = nextIsAgentSession;
        setIsAgentSession(nextIsAgentSession);

        if (!nextIsAgentSession) {
          writeEnabledPreference(false);
          teardownRuntime();
          setMessage("Go live to let CashNode match nearby receiver pickups using your current device location.");
          return;
        }

        const presenceResponse = await authFetch("/api/agent-presence", {
          method: "GET",
          cache: "no-store"
        });
        const presencePayload = (await presenceResponse.json()) as {
          error?: string;
          presence?: AppAgentPresence | null;
        };

        if (!presenceResponse.ok) {
          throw new Error(presencePayload.error ?? "Unable to load the live agent presence state.");
        }

        const nextPresence = presencePayload.presence ?? null;
        setPresence(nextPresence);

        if (nextPresence && nextPresence.latitude !== null && nextPresence.longitude !== null) {
          lastKnownCoordinatesRef.current = {
            latitude: nextPresence.latitude,
            longitude: nextPresence.longitude,
            accuracyMeters: nextPresence.accuracyMeters ?? undefined
          };
        }

        const shouldResume = readEnabledPreference() || Boolean(nextPresence?.isOnline && !nextPresence.stale);

        enabledRef.current = shouldResume;

        if (shouldResume) {
          writeEnabledPreference(true);

          if (watchIdRef.current === null) {
            void startLiveDispatch(true);
          } else {
            ensureHeartbeatTimer();
          }
        } else {
          stopWatching();
          clearHeartbeatTimer();
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load the live agent presence state.");
      } finally {
        setIsLoading(false);
      }
    };

    void hydrateRuntime();
  }, [pathname]);

  useEffect(() => {
    const sendFinalHeartbeat = () => {
      const coordinates = lastKnownCoordinatesRef.current;

      if (!enabledRef.current || !coordinates) {
        return;
      }

      void pushPresenceHeartbeat(coordinates, {
        keepalive: true,
        silent: true
      }).catch(() => undefined);
    };

    const handleVisibilityChange = () => {
      if (!enabledRef.current) {
        return;
      }

      if (document.visibilityState === "hidden") {
        sendFinalHeartbeat();

        return;
      }

      void refreshCurrentLocation({
        maximumAge: 10000,
        silent: true
      }).catch((error) => {
        setMessage(normalizeGeolocationErrorMessage(error));
      });

      ensureGeolocationWatch();
      ensureHeartbeatTimer();
    };

    const handlePageShow = () => {
      if (!enabledRef.current) {
        return;
      }

      void refreshCurrentLocation({
        maximumAge: 10000,
        forceRefresh: true,
        silent: true
      }).catch((error) => {
        setMessage(normalizeGeolocationErrorMessage(error));
      });

      ensureGeolocationWatch();
      ensureHeartbeatTimer();
    };

    const handleOnline = () => {
      if (!enabledRef.current) {
        return;
      }

      const coordinates = lastKnownCoordinatesRef.current;

      if (coordinates) {
        void pushPresenceHeartbeat(coordinates, {
          forceRefresh: true,
          silent: true
        }).catch((error) => {
          setMessage(error instanceof Error ? error.message : "Unable to reconnect live dispatch.");
        });
      }
    };

    const handleOffline = () => {
      if (!enabledRef.current) {
        return;
      }

      setMessage("The connection dropped. CashNode will resume live dispatch as soon as the device is back online.");
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== agentPresencePreferenceKey) {
        return;
      }

      if (event.newValue === "1") {
        if (!enabledRef.current) {
          void startLiveDispatch(true);
        }

        return;
      }

      if (enabledRef.current) {
        void stopLiveDispatch();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", sendFinalHeartbeat);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("focus", handlePageShow);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("storage", handleStorage);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", sendFinalHeartbeat);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("focus", handlePageShow);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("storage", handleStorage);
    };
  }, [isAgentSession]);

  useEffect(() => {
    return () => {
      stopWatching();
      clearHeartbeatTimer();
    };
  }, []);

  const value = useMemo<AgentPresenceRuntimeContextValue>(
    () => ({
      isAgentSession,
      isLoading,
      isUpdating,
      isLive,
      presence,
      message,
      goLive: () => startLiveDispatch(false),
      goOffline: stopLiveDispatch
    }),
    [isAgentSession, isLoading, isUpdating, isLive, presence, message]
  );

  return <AgentPresenceRuntimeContext.Provider value={value}>{children}</AgentPresenceRuntimeContext.Provider>;
}

export function useAgentPresenceRuntime() {
  const context = useContext(AgentPresenceRuntimeContext);

  if (!context) {
    throw new Error("useAgentPresenceRuntime must be used inside AgentPresenceRuntimeProvider.");
  }

  return context;
}
