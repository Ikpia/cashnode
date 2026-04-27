"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppAgentPresence } from "@/lib/agent-presence";

type AgentLivePresencePanelProps = {
  fallbackHub: string;
};

type CoordinatesSnapshot = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
};

function formatCoordinates(latitude: number | null, longitude: number | null) {
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return "Waiting for device location";
  }

  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function formatLastSeen(value: string | null) {
  if (!value) {
    return "No heartbeat yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

export function AgentLivePresencePanel({ fallbackHub }: AgentLivePresencePanelProps) {
  const router = useRouter();
  const [presence, setPresence] = useState<AppAgentPresence | null>(null);
  const [message, setMessage] = useState("Go live to let CashNode match nearby receiver pickups using your current device location.");
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const lastKnownCoordinatesRef = useRef<CoordinatesSnapshot | null>(null);
  const lastSentAtRef = useRef(0);
  const lastRefreshAtRef = useRef(0);

  const isLive = Boolean(presence?.isOnline && !presence.stale);

  const statusMeta = useMemo(() => {
    if (isUpdating) {
      return {
        label: "Syncing",
        className: "status-pending inline-flex"
      };
    }

    if (isLive) {
      return {
        label: "Live now",
        className: "status-success inline-flex"
      };
    }

    return {
      label: "Offline",
      className: "inline-flex rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-500"
    };
  }, [isLive, isUpdating]);

  const stopWatching = () => {
    if (watchIdRef.current !== null && typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = null;
  };

  const maybeRefreshDashboard = (force = false) => {
    const now = Date.now();

    if (!force && now - lastRefreshAtRef.current < 60000) {
      return;
    }

    lastRefreshAtRef.current = now;
    startTransition(() => {
      router.refresh();
    });
  };

  const pushPresence = async (coordinates: CoordinatesSnapshot, forceRefresh = false) => {
    lastKnownCoordinatesRef.current = coordinates;
    lastSentAtRef.current = Date.now();

    const response = await fetch("/api/agent-presence", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(coordinates)
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

    setMessage("Live dispatch is active. CashNode is now matching nearby receiver pickups using your current device location.");
    maybeRefreshDashboard(forceRefresh);
  };

  const startLiveDispatch = async (resume = false) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setMessage("This browser does not support device geolocation, so live dispatch cannot start here.");
      return;
    }

    setIsUpdating(true);

    const handlePosition = async (position: GeolocationPosition, forceRefresh = false) => {
      const coordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy
      };

      await pushPresence(coordinates, forceRefresh);
    };

    try {
      await new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            void handlePosition(position, true).then(resolve).catch(reject);
          },
          (error) => {
            reject(error);
          },
          {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 0
          }
        );
      });

      if (watchIdRef.current === null) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const now = Date.now();

            if (now - lastSentAtRef.current < 15000) {
              return;
            }

            void handlePosition(position).catch((error) => {
              setMessage(error instanceof Error ? error.message : "Unable to refresh live agent presence.");
            });
          },
          (error) => {
            setMessage(
              error.code === error.PERMISSION_DENIED
                ? "Location access was denied. Allow location access to receive nearby payout matches."
                : error.message || "Unable to watch the device location right now."
            );
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 15000
          }
        );
      }

      if (!resume) {
        setMessage("Live dispatch is active. CashNode will keep using your current device location while you stay online.");
      }
    } catch (error) {
      const geolocationErrorCode =
        typeof error === "object" && error && "code" in error && typeof error.code === "number" ? error.code : null;
      const geolocationErrorMessage =
        typeof error === "object" && error && "message" in error && typeof error.message === "string" ? error.message : "";

      setMessage(
        geolocationErrorCode === 1
          ? "Location access was denied. Allow location access to receive nearby payout matches."
          : geolocationErrorMessage || "Unable to start live dispatch right now."
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const stopLiveDispatch = async () => {
    stopWatching();
    setIsUpdating(true);

    try {
      const response = await fetch("/api/agent-presence", {
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
      maybeRefreshDashboard(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to stop live dispatch.");
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    const loadPresence = async () => {
      try {
        const response = await fetch("/api/agent-presence", {
          method: "GET",
          cache: "no-store"
        });
        const payload = (await response.json()) as {
          error?: string;
          presence?: AppAgentPresence | null;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load the live agent presence state.");
        }

        setPresence(payload.presence ?? null);

        if (payload.presence?.isOnline) {
          void startLiveDispatch(true);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load the live agent presence state.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadPresence();

    return () => {
      stopWatching();
    };
  }, []);

  useEffect(() => {
    if (!isLive || !lastKnownCoordinatesRef.current) {
      return;
    }

    const interval = window.setInterval(() => {
      const coordinates = lastKnownCoordinatesRef.current;

      if (!coordinates) {
        return;
      }

      void pushPresence(coordinates).catch((error) => {
        setMessage(error instanceof Error ? error.message : "Unable to keep the live agent presence active.");
      });
    }, 45000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isLive]);

  return (
    <section className="page-card mb-8 p-6 md:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-headline-md text-on-surface">Live Dispatch</h2>
            <span className={statusMeta.className}>{statusMeta.label}</span>
          </div>
          <p className="max-w-2xl text-body-md text-on-surface-variant">
            Matching now uses your current device location instead of just your saved hub. Stay live to receive the nearest receiver pickups around you.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void (isLive ? stopLiveDispatch() : startLiveDispatch())}
          disabled={isLoading || isUpdating}
          className={`rounded-xl px-6 py-3 text-sm font-semibold shadow-md transition-opacity disabled:cursor-not-allowed disabled:opacity-60 ${
            isLive ? "border border-primary/15 bg-white text-primary" : "bg-primary text-white"
          }`}
        >
          {isLoading ? "Loading..." : isUpdating ? "Updating..." : isLive ? "Go Offline" : "Go Live"}
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-surface-container-low p-4">
          <div className="text-caption text-on-surface-variant">Current coordinates</div>
          <div className="mt-2 text-sm font-semibold text-on-surface">
            {formatCoordinates(presence?.latitude ?? null, presence?.longitude ?? null)}
          </div>
        </div>

        <div className="rounded-2xl bg-surface-container-low p-4">
          <div className="text-caption text-on-surface-variant">Location accuracy</div>
          <div className="mt-2 text-sm font-semibold text-on-surface">
            {typeof presence?.accuracyMeters === "number" ? `${Math.round(presence.accuracyMeters)} m` : "Waiting for GPS"}
          </div>
        </div>

        <div className="rounded-2xl bg-surface-container-low p-4">
          <div className="text-caption text-on-surface-variant">Fallback hub</div>
          <div className="mt-2 text-sm font-semibold text-on-surface">{fallbackHub}</div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-primary/5 px-4 py-4 text-sm text-on-surface-variant">
        <div className="font-semibold text-on-surface">{message}</div>
        <div className="mt-2">
          Last heartbeat: <span className="font-semibold text-on-surface">{formatLastSeen(presence?.lastSeenAt ?? null)}</span>
        </div>
      </div>
    </section>
  );
}
