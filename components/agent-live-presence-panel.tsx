"use client";

import { useMemo } from "react";
import { useAgentPresenceRuntime } from "@/components/agent-presence-runtime";
import { PickupMapEmbed } from "@/components/pickup-map-embed";
import { Icon } from "@/components/ui/icon";
import { buildPickupMapEmbedUrl, calculateDistanceKm, formatDistanceLabel } from "@/lib/pickup-locations";

type AgentLivePresencePanelProps = {
  fallbackHub: string;
  fallbackAddress: string;
  fallbackLatitude: number | null;
  fallbackLongitude: number | null;
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

function buildCoordinateSearchUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

export function AgentLivePresencePanel({
  fallbackHub,
  fallbackAddress,
  fallbackLatitude,
  fallbackLongitude
}: AgentLivePresencePanelProps) {
  const { isLoading, isUpdating, isLive, presence, message, goLive, goOffline } = useAgentPresenceRuntime();

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

  const liveCoordinates =
    typeof presence?.latitude === "number" && typeof presence?.longitude === "number"
      ? {
          latitude: presence.latitude,
          longitude: presence.longitude
        }
      : null;
  const fallbackCoordinates =
    typeof fallbackLatitude === "number" && typeof fallbackLongitude === "number"
      ? {
          latitude: fallbackLatitude,
          longitude: fallbackLongitude
        }
      : null;
  const mapCoordinates = liveCoordinates ?? fallbackCoordinates;
  const mapEmbedUrl = mapCoordinates ? buildPickupMapEmbedUrl(mapCoordinates) : null;
  const locationSource = liveCoordinates ? "Current device location" : "Saved hub fallback";
  const hubDriftLabel =
    liveCoordinates && fallbackCoordinates
      ? formatDistanceLabel(calculateDistanceKm(liveCoordinates, fallbackCoordinates))
      : null;
  const accuracyLabel =
    typeof presence?.accuracyMeters === "number" ? `${Math.round(presence.accuracyMeters)} m` : "Waiting for GPS";
  const openMapHref = mapCoordinates ? buildCoordinateSearchUrl(mapCoordinates.latitude, mapCoordinates.longitude) : "#";

  return (
    <section className="page-card mb-8 p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-headline-md text-on-surface">Live Dispatch</h2>
            <span className={statusMeta.className}>{statusMeta.label}</span>
          </div>
          <p className="max-w-2xl text-body-md text-on-surface-variant">
            Matching now uses your current device location instead of just your saved hub. The background heartbeat stays active across navigation, focus changes, reconnects, and quick mobile resumes while this session stays live.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void (isLive ? goOffline() : goLive())}
          disabled={isLoading || isUpdating}
          className={`rounded-xl px-6 py-3 text-sm font-semibold shadow-md transition-opacity disabled:cursor-not-allowed disabled:opacity-60 ${
            isLive ? "border border-primary/15 bg-white text-primary" : "bg-primary text-white"
          }`}
        >
          {isLoading ? "Loading..." : isUpdating ? "Updating..." : isLive ? "Go Offline" : "Go Live"}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <div className="overflow-hidden rounded-[1.75rem] border border-stone-200/70 bg-surface-container-low p-3">
            {mapEmbedUrl ? (
              <PickupMapEmbed
                title={liveCoordinates ? "Agent live dispatch map" : "Agent fallback hub map"}
                src={mapEmbedUrl}
                className="h-[280px]"
              />
            ) : (
              <div className="flex h-[280px] items-center justify-center rounded-2xl bg-stone-100 text-sm text-on-surface-variant">
                Map becomes available once a saved hub or live device location is present.
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-surface-container-low p-4">
              <div className="text-caption text-on-surface-variant">Map source</div>
              <div className="mt-2 text-sm font-semibold text-on-surface">{locationSource}</div>
            </div>
            <div className="rounded-2xl bg-surface-container-low p-4">
              <div className="text-caption text-on-surface-variant">Saved hub drift</div>
              <div className="mt-2 text-sm font-semibold text-on-surface">{hubDriftLabel ?? "Waiting for live GPS"}</div>
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-5">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-2xl bg-surface-container-low p-4">
              <div className="text-caption text-on-surface-variant">Current coordinates</div>
              <div className="mt-2 text-sm font-semibold text-on-surface">
                {formatCoordinates(presence?.latitude ?? null, presence?.longitude ?? null)}
              </div>
            </div>

            <div className="rounded-2xl bg-surface-container-low p-4">
              <div className="text-caption text-on-surface-variant">Location accuracy</div>
              <div className="mt-2 text-sm font-semibold text-on-surface">{accuracyLabel}</div>
            </div>
          </div>

          <div className="rounded-2xl bg-surface-container-low p-4">
            <div className="text-caption text-on-surface-variant">Fallback hub</div>
            <div className="mt-2 font-semibold text-on-surface">{fallbackHub}</div>
            <div className="mt-1 text-sm text-on-surface-variant">{fallbackAddress}</div>
          </div>

          <div className="rounded-2xl bg-primary/5 px-4 py-4 text-sm text-on-surface-variant">
            <div className="font-semibold text-on-surface">{message}</div>
            <div className="mt-2">
              Last heartbeat: <span className="font-semibold text-on-surface">{formatLastSeen(presence?.lastSeenAt ?? null)}</span>
            </div>
          </div>

          <a
            href={openMapHref}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${
              mapCoordinates ? "border border-primary/15 bg-white text-primary" : "pointer-events-none border border-stone-200 bg-white text-stone-400"
            }`}
          >
            <Icon name="map" className="text-[18px]" />
            Open current pin
          </a>
        </div>
      </div>
    </section>
  );
}
