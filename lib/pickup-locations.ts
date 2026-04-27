export type PickupLocationOption = {
  id: string;
  area: string;
  address: string;
  latitude: number;
  longitude: number;
  aliases?: string[];
};

export const lagosPickupLocations: PickupLocationOption[] = [
  {
    id: "ikeja-city-mall",
    area: "Ikeja City Mall, Alausa",
    address: "Obafemi Awolowo Way, Alausa, Ikeja, Lagos",
    latitude: 6.6141,
    longitude: 3.3571,
    aliases: ["North Terminal Branch"]
  },
  {
    id: "tejuosho-shopping-complex",
    area: "Tejuosho Shopping Complex, Yaba",
    address: "Ojuelegba Road, Yaba, Lagos",
    latitude: 6.50885,
    longitude: 3.36968,
    aliases: ["West Side Hub"]
  },
  {
    id: "tafawa-balewa-square",
    area: "Tafawa Balewa Square, Onikan",
    address: "21 Tafawa Balewa Road, Onikan, Lagos Island, Lagos",
    latitude: 6.44659,
    longitude: 3.40185,
    aliases: ["Downtown Financial District"]
  },
  {
    id: "circle-mall",
    area: "Circle Mall, Osapa Lekki",
    address: "Lekki-Epe Expressway, Osapa, Lekki, Lagos",
    latitude: 6.4544967,
    longitude: 3.5052199,
    aliases: ["Eastside Exchange"]
  }
];

const fallbackPickupLocation = lagosPickupLocations[0];

function normalizePickupKey(value: string) {
  return value.trim().toLowerCase();
}

export function getPickupLocationById(locationId?: string | null) {
  if (!locationId) {
    return null;
  }

  return lagosPickupLocations.find((location) => location.id === locationId.trim()) ?? null;
}

export function findPickupLocation(value?: string | null) {
  if (!value) {
    return null;
  }

  const exactLocationMatch = getPickupLocationById(value);

  if (exactLocationMatch) {
    return exactLocationMatch;
  }

  const normalizedValue = normalizePickupKey(value);

  return (
    lagosPickupLocations.find((location) =>
      [location.area, location.address, ...(location.aliases ?? [])].some((entry) => normalizePickupKey(entry) === normalizedValue)
    ) ?? null
  );
}

export function resolvePickupLocation(value?: string | null) {
  return findPickupLocation(value) ?? fallbackPickupLocation;
}

export function buildPickupDirectionsUrl(location: PickupLocationOption) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${location.area}, ${location.address}`
  )}`;
}

export function buildPickupMapEmbedUrl(location: Pick<PickupLocationOption, "latitude" | "longitude">) {
  const latPadding = 0.008;
  const lonPadding = 0.01;
  const left = (location.longitude - lonPadding).toFixed(6);
  const right = (location.longitude + lonPadding).toFixed(6);
  const top = (location.latitude + latPadding).toFixed(6);
  const bottom = (location.latitude - latPadding).toFixed(6);

  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${location.latitude}%2C${location.longitude}`;
}

export function formatPickupCoordinates(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function calculateDistanceKm(
  from: Pick<PickupLocationOption, "latitude" | "longitude">,
  to: Pick<PickupLocationOption, "latitude" | "longitude">
) {
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function formatDistanceLabel(distanceKm: number) {
  if (distanceKm < 1) {
    return `${Math.max(100, Math.round(distanceKm * 1000 / 100) * 100)} m away`;
  }

  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km away`;
}
