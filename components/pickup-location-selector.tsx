"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { authFetch } from "@/lib/client-auth";
import type { PickupLocationOption } from "@/lib/pickup-locations";

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

type PickupLocationSelectorProps = {
  locations: PickupLocationOption[];
  areaFieldName?: string;
  detailFieldName?: string;
  initialLocationId?: string;
  initialDetail?: string;
  previewEnabled?: boolean;
  previewTokenAmountInputId?: string;
  hubLabel?: string;
  helperCopy?: string;
  onLocationChange?: (location: PickupLocationOption | null) => void;
  onDetailChange?: (value: string) => void;
};

export function PickupLocationSelector({
  locations,
  areaFieldName = "pickupArea",
  detailFieldName = "pickupLocationDetail",
  initialLocationId,
  initialDetail = "",
  previewEnabled = true,
  previewTokenAmountInputId = "sender-token-amount",
  hubLabel = "Pickup Hub",
  helperCopy = "If the exact neighborhood is missing, type it below while still choosing the nearest listed hub.",
  onLocationChange,
  onDetailChange
}: PickupLocationSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const allStates = useMemo(() => uniqueSorted(locations.map((location) => location.state)), [locations]);
  const initialLocation = locations.find((location) => location.id === initialLocationId) ?? locations[0] ?? null;
  const initialState = initialLocation?.state ?? allStates[0] ?? "";
  const initialCities = uniqueSorted(
    locations.filter((location) => location.state === initialState).map((location) => location.city)
  );
  const initialCity = initialLocation?.city ?? initialCities[0] ?? "";
  const initialHubs = locations.filter((location) => location.state === initialState && location.city === initialCity);
  const initialHubId = initialLocation?.id ?? initialHubs[0]?.id ?? locations[0]?.id ?? "";

  const [selectedState, setSelectedState] = useState(initialState);
  const [selectedCity, setSelectedCity] = useState(initialCity);
  const [selectedHubId, setSelectedHubId] = useState(initialHubId);
  const [customLocationDetail, setCustomLocationDetail] = useState(initialDetail);
  const [tokenAmount, setTokenAmount] = useState("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [preview, setPreview] = useState<{
    estimatedLocalAmount: number;
    localCurrency: "NGN";
    nearestAgent: {
      name: string;
      rating: number;
      transferCount: number;
      distanceLabel: string;
      serviceZone: string | null;
    } | null;
  } | null>(null);

  const matchingLocations = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return [];
    }

    return locations.filter((location) =>
      [location.state, location.city, location.area, location.address, ...(location.aliases ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [locations, searchTerm]);

  const states = allStates;

  const cities = useMemo(
    () => uniqueSorted(locations.filter((location) => location.state === selectedState).map((location) => location.city)),
    [locations, selectedState]
  );

  const hubs = useMemo(
    () => locations.filter((location) => location.state === selectedState && location.city === selectedCity),
    [locations, selectedState, selectedCity]
  );

  const selectedHub = hubs.find((hub) => hub.id === selectedHubId) ?? hubs[0] ?? null;
  const lastEmittedHubIdRef = useRef<string | null>(null);
  const lastEmittedDetailRef = useRef<string>(initialDetail);
  const onLocationChangeRef = useRef(onLocationChange);
  const onDetailChangeRef = useRef(onDetailChange);

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  useEffect(() => {
    onDetailChangeRef.current = onDetailChange;
  }, [onDetailChange]);

  useEffect(() => {
    const nextHubId = selectedHub?.id ?? null;

    if (lastEmittedHubIdRef.current === nextHubId) {
      return;
    }

    lastEmittedHubIdRef.current = nextHubId;
    onLocationChangeRef.current?.(selectedHub);
  }, [selectedHub]);

  useEffect(() => {
    const nextInitialLocation = locations.find((location) => location.id === initialLocationId);

    if (!nextInitialLocation) {
      return;
    }

    setSelectedState((currentState) =>
      currentState === nextInitialLocation.state ? currentState : nextInitialLocation.state
    );
    setSelectedCity((currentCity) =>
      currentCity === nextInitialLocation.city ? currentCity : nextInitialLocation.city
    );
    setSelectedHubId((currentHubId) =>
      currentHubId === nextInitialLocation.id ? currentHubId : nextInitialLocation.id
    );
  }, [initialLocationId, locations]);

  useEffect(() => {
    setCustomLocationDetail(initialDetail);
  }, [initialDetail]);

  useEffect(() => {
    if (lastEmittedDetailRef.current === customLocationDetail) {
      return;
    }

    lastEmittedDetailRef.current = customLocationDetail;
    onDetailChangeRef.current?.(customLocationDetail);
  }, [customLocationDetail]);

  useEffect(() => {
    const nextState = states.includes(selectedState) ? selectedState : states[0] ?? "";
    const nextCities = uniqueSorted(locations.filter((location) => location.state === nextState).map((location) => location.city));
    const nextCity = nextCities.includes(selectedCity) ? selectedCity : nextCities[0] ?? "";
    const nextHubs = locations.filter((location) => location.state === nextState && location.city === nextCity);
    const nextHubId = nextHubs.some((hub) => hub.id === selectedHubId) ? selectedHubId : nextHubs[0]?.id ?? "";

    if (nextState !== selectedState) {
      setSelectedState(nextState);
    }

    if (nextCity !== selectedCity) {
      setSelectedCity(nextCity);
    }

    if (nextHubId !== selectedHubId) {
      setSelectedHubId(nextHubId);
    }
  }, [locations, selectedCity, selectedHubId, selectedState, states]);

  useEffect(() => {
    if (!matchingLocations.length) {
      return;
    }

    const exactMatch =
      matchingLocations.find((location) => location.id === searchTerm.trim()) ??
      matchingLocations.find(
        (location) =>
          [location.state, location.city, location.area, location.address, ...(location.aliases ?? [])]
            .some((entry) => entry.toLowerCase() === searchTerm.trim().toLowerCase())
      );
    const nextLocation = exactMatch ?? matchingLocations[0];

    if (nextLocation.state !== selectedState) {
      setSelectedState(nextLocation.state);
    }

    if (nextLocation.city !== selectedCity) {
      setSelectedCity(nextLocation.city);
    }

    if (nextLocation.id !== selectedHubId) {
      setSelectedHubId(nextLocation.id);
    }
  }, [matchingLocations, searchTerm, selectedCity, selectedHubId, selectedState]);

  useEffect(() => {
    if (!previewEnabled) {
      return;
    }

    const amountInput = document.getElementById(previewTokenAmountInputId) as HTMLInputElement | null;

    if (!amountInput) {
      return;
    }

    const updateAmount = () => setTokenAmount(amountInput.value);
    updateAmount();
    amountInput.addEventListener("input", updateAmount);

    return () => {
      amountInput.removeEventListener("input", updateAmount);
    };
  }, [previewEnabled, previewTokenAmountInputId]);

  useEffect(() => {
    if (!previewEnabled) {
      setPreview(null);
      setPreviewError("");
      return;
    }

    const numericAmount = Number(tokenAmount);

    if (!selectedHub?.id || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setPreview(null);
      setPreviewError("");
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setIsPreviewLoading(true);
      setPreviewError("");

      try {
        const response = await authFetch(
          `/api/payout-requests/nearest-agent?pickupArea=${encodeURIComponent(selectedHub.id)}&tokenAmount=${encodeURIComponent(
            String(numericAmount)
          )}&tokenType=USDT`,
          {
            method: "GET",
            cache: "no-store"
          }
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to preview nearest eligible agent.");
        }

        setPreview(payload.preview ?? null);
      } catch (error) {
        setPreview(null);
        setPreviewError(error instanceof Error ? error.message : "Unable to preview nearest eligible agent.");
      } finally {
        setIsPreviewLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [selectedHub?.id, tokenAmount]);

  return (
    <div className="space-y-4">
      <input type="hidden" name={areaFieldName} value={selectedHub?.id ?? ""} />

      <label className="space-y-2">
        <span className="text-sm font-semibold text-stone-600">Search location</span>
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search state, city, or hub"
          className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
      </label>

      <div className="grid gap-6 md:grid-cols-3">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-stone-600">Pickup State</span>
          <select
            value={selectedState}
            onChange={(event) => {
              const nextState = event.target.value;
              const nextCities = uniqueSorted(
                locations.filter((location) => location.state === nextState).map((location) => location.city)
              );
              const nextCity = nextCities[0] ?? "";
              const nextHubs = locations.filter(
                (location) => location.state === nextState && location.city === nextCity
              );

              setSelectedState(nextState);
              setSelectedCity(nextCity);
              setSelectedHubId(nextHubs[0]?.id ?? "");
            }}
            className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
          >
            {states.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-stone-600">Pickup City</span>
          <select
            value={selectedCity}
            onChange={(event) => {
              const nextCity = event.target.value;
              const nextHubs = locations.filter(
                (location) => location.state === selectedState && location.city === nextCity
              );

              setSelectedCity(nextCity);
              setSelectedHubId(nextHubs[0]?.id ?? "");
            }}
            className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
          >
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-stone-600">{hubLabel}</span>
          <select
            value={selectedHubId}
            onChange={(event) => setSelectedHubId(event.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
          >
            {hubs.map((hub) => (
              <option key={hub.id} value={hub.id}>
                {hub.area}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedHub ? (
        <div className="rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
          Selected pickup point: <span className="font-semibold text-on-surface">{selectedHub.address}</span>
        </div>
      ) : null}

      <label className="space-y-2">
        <span className="text-sm font-semibold text-stone-600">Location not listed? Type it here</span>
        <input
          type="text"
          name={detailFieldName}
          value={customLocationDetail}
          onChange={(event) => setCustomLocationDetail(event.target.value)}
          placeholder="Example: Ama Hausa, near First Bank junction"
          className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
        <p className="text-xs text-on-surface-variant">{helperCopy}</p>
      </label>

      {searchTerm.trim() ? (
        <div className="rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
          {matchingLocations.length > 0
            ? `Search matched ${matchingLocations.length} location${matchingLocations.length === 1 ? "" : "s"}.`
            : "No pickup location matches that search yet."}
        </div>
      ) : null}

      {previewEnabled && isPreviewLoading ? (
        <div className="rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
          Finding nearest eligible POS agent...
        </div>
      ) : null}

      {previewEnabled && previewError ? <div className="rounded-xl bg-[#fff1f1] px-4 py-3 text-sm text-[#b42318]">{previewError}</div> : null}

      {previewEnabled && preview ? (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-4 text-sm">
          <p className="font-semibold text-on-surface">
            Estimated payout in NGN:{" "}
            <span className="text-primary">
              {preview.localCurrency} {preview.estimatedLocalAmount.toLocaleString("en-NG")}
            </span>
          </p>
          {preview.nearestAgent ? (
            <div className="mt-2 text-on-surface-variant">
              Nearest eligible agent: <span className="font-semibold text-on-surface">{preview.nearestAgent.name}</span> ({preview.nearestAgent.distanceLabel})
            </div>
          ) : (
            <div className="mt-2 text-[#b42318]">No eligible agent is currently available for this amount and location.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
