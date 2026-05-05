export type PickupLocationOption = {
  id: string;
  state: string;
  city: string;
  area: string;
  address: string;
  latitude: number;
  longitude: number;
  aliases?: string[];
};

export const nigeriaPickupLocations: PickupLocationOption[] = [
  { id: "fct-wuse-market", state: "FCT", city: "Abuja", area: "Wuse Market, Abuja", address: "Sani Abacha Way, Wuse Zone 5, Abuja", latitude: 9.0765, longitude: 7.4951 },
  { id: "fct-garki-market", state: "FCT", city: "Abuja", area: "Garki International Market, Abuja", address: "Area 10, Garki, Abuja", latitude: 9.0405, longitude: 7.4894 },
  { id: "abia-umuahia-market", state: "Abia", city: "Umuahia", area: "Ubani Market, Umuahia", address: "Ubani Ibeku Road, Umuahia, Abia", latitude: 5.5321, longitude: 7.486 },
  { id: "abia-aba-ariaria", state: "Abia", city: "Aba", area: "Ariaria International Market, Aba", address: "Faulks Road, Aba, Abia", latitude: 5.1066, longitude: 7.3667 },
  { id: "adamawa-yola-jimeta", state: "Adamawa", city: "Yola", area: "Jimeta Modern Market, Yola", address: "Mubi Road, Jimeta, Yola, Adamawa", latitude: 9.2791, longitude: 12.4585 },
  { id: "adamawa-mubi-main", state: "Adamawa", city: "Mubi", area: "Mubi Central Market", address: "Maiha Road, Mubi, Adamawa", latitude: 10.2676, longitude: 13.2667 },
  { id: "akwaibom-uyo-plaza", state: "Akwa Ibom", city: "Uyo", area: "Ibom Plaza, Uyo", address: "Wellington Bassey Way, Uyo, Akwa Ibom", latitude: 5.036, longitude: 7.9236 },
  { id: "akwaibom-eket-main", state: "Akwa Ibom", city: "Eket", area: "Eket Main Market", address: "Eket-Oron Road, Eket, Akwa Ibom", latitude: 4.6423, longitude: 7.9244 },
  { id: "anambra-awka-ezeuzu", state: "Anambra", city: "Awka", area: "Eke Awka Market", address: "Zik Avenue, Awka, Anambra", latitude: 6.2127, longitude: 7.0719 },
  { id: "anambra-onitsha-main", state: "Anambra", city: "Onitsha", area: "Onitsha Main Market", address: "New Market Road, Onitsha, Anambra", latitude: 6.1462, longitude: 6.7884 },
  { id: "bauchi-bauchi-central", state: "Bauchi", city: "Bauchi", area: "Central Market, Bauchi", address: "Ahmadu Bello Way, Bauchi", latitude: 10.3158, longitude: 9.8442 },
  { id: "bauchi-azare-main", state: "Bauchi", city: "Azare", area: "Azare Central Market", address: "Potiskum Road, Azare, Bauchi", latitude: 11.6765, longitude: 10.1938 },
  { id: "bayelsa-yenagoa-swani", state: "Bayelsa", city: "Yenagoa", area: "Swali Market, Yenagoa", address: "Mbiama-Yenagoa Road, Yenagoa, Bayelsa", latitude: 4.9267, longitude: 6.2676 },
  { id: "bayelsa-yenagoa-kpansia", state: "Bayelsa", city: "Yenagoa", area: "Kpansia Market, Yenagoa", address: "Kpansia Road, Yenagoa, Bayelsa", latitude: 4.9342, longitude: 6.2738 },
  { id: "benue-makurdi-wurukum", state: "Benue", city: "Makurdi", area: "Wurukum Market, Makurdi", address: "Gboko Road, Wurukum, Makurdi", latitude: 7.7406, longitude: 8.5122 },
  { id: "benue-gboko-main", state: "Benue", city: "Gboko", area: "Gboko Main Market", address: "Aliade Road, Gboko, Benue", latitude: 7.3224, longitude: 9.0034 },
  { id: "borno-maiduguri-monday", state: "Borno", city: "Maiduguri", area: "Monday Market, Maiduguri", address: "Baga Road, Maiduguri, Borno", latitude: 11.8469, longitude: 13.1603 },
  { id: "borno-biu-central", state: "Borno", city: "Biu", area: "Biu Central Market", address: "Biu-Damboa Road, Biu, Borno", latitude: 10.6129, longitude: 12.1946 },
  { id: "crossriver-calabar-watt", state: "Cross River", city: "Calabar", area: "Watt Market, Calabar", address: "Old Odukpani Road, Calabar, Cross River", latitude: 4.9589, longitude: 8.3269 },
  { id: "crossriver-ikom-main", state: "Cross River", city: "Ikom", area: "Ikom Main Market", address: "Akamkpa Road, Ikom, Cross River", latitude: 5.9667, longitude: 8.7167 },
  { id: "delta-asaba-ogbeogonogo", state: "Delta", city: "Asaba", area: "Ogbeogonogo Market, Asaba", address: "Nnebisi Road, Asaba, Delta", latitude: 6.2017, longitude: 6.7312 },
  { id: "delta-warri-iyara", state: "Delta", city: "Warri", area: "Igbudu Market, Warri", address: "Effurun-Sapele Road, Warri, Delta", latitude: 5.5547, longitude: 5.7932 },
  { id: "ebonyi-abakaliki-intl", state: "Ebonyi", city: "Abakaliki", area: "International Market, Abakaliki", address: "Ogoja Road, Abakaliki, Ebonyi", latitude: 6.3228, longitude: 8.1137 },
  { id: "ebonyi-afikpo-main", state: "Ebonyi", city: "Afikpo", area: "Afikpo Main Market", address: "Amaizu Road, Afikpo, Ebonyi", latitude: 5.8898, longitude: 7.9353 },
  { id: "edo-benin-obamarket", state: "Edo", city: "Benin City", area: "Oba Market, Benin City", address: "Ring Road, Benin City, Edo", latitude: 6.3382, longitude: 5.6257 },
  { id: "edo-ekpoma-main", state: "Edo", city: "Ekpoma", area: "Ekpoma Main Market", address: "Benin-Auchi Road, Ekpoma, Edo", latitude: 6.743, longitude: 6.1403 },
  { id: "ekiti-ado-ekiti-okesa", state: "Ekiti", city: "Ado Ekiti", area: "Oja Oba, Ado Ekiti", address: "Old Garage Road, Ado Ekiti, Ekiti", latitude: 7.6231, longitude: 5.2209 },
  { id: "ekiti-ikere-main", state: "Ekiti", city: "Ikere", area: "Ikere Main Market", address: "Ado-Ikere Road, Ikere, Ekiti", latitude: 7.4975, longitude: 5.2304 },
  { id: "enugu-ogbete-main", state: "Enugu", city: "Enugu", area: "Ogbete Main Market, Enugu", address: "Ogbete Road, Enugu", latitude: 6.4483, longitude: 7.5028 },
  { id: "enugu-nsukka-ogige", state: "Enugu", city: "Nsukka", area: "Ogige Market, Nsukka", address: "Onuiyi Road, Nsukka, Enugu", latitude: 6.8597, longitude: 7.3958 },
  { id: "gombe-tashan-duku", state: "Gombe", city: "Gombe", area: "Tashan Dukku Market, Gombe", address: "Dukku Road, Gombe", latitude: 10.2897, longitude: 11.1673 },
  { id: "gombe-kumo-main", state: "Gombe", city: "Kumo", area: "Kumo Main Market", address: "Kumo Road, Kumo, Gombe", latitude: 10.0467, longitude: 11.2131 },
  { id: "imo-owerri-reliance", state: "Imo", city: "Owerri", area: "Relief Market, Owerri", address: "Wetheral Road, Owerri, Imo", latitude: 5.492, longitude: 7.0349 },
  { id: "imo-orlu-eziachi", state: "Imo", city: "Orlu", area: "Eziachi Market, Orlu", address: "Amesi Road, Orlu, Imo", latitude: 5.7924, longitude: 7.0351 },
  { id: "jigawa-dutse-farin-kasa", state: "Jigawa", city: "Dutse", area: "Farin Kasa Market, Dutse", address: "Kano Road, Dutse, Jigawa", latitude: 11.7579, longitude: 9.3388 },
  { id: "jigawa-hadejia-main", state: "Jigawa", city: "Hadejia", area: "Hadejia Central Market", address: "Kafin Hausa Road, Hadejia, Jigawa", latitude: 12.4535, longitude: 10.0411 },
  { id: "kaduna-kaduna-central", state: "Kaduna", city: "Kaduna", area: "Central Market, Kaduna", address: "Ahmadu Bello Way, Kaduna", latitude: 10.5206, longitude: 7.4388 },
  { id: "kaduna-zaria-sabon-gari", state: "Kaduna", city: "Zaria", area: "Sabon Gari Market, Zaria", address: "Sokoto Road, Sabon Gari, Zaria, Kaduna", latitude: 11.0855, longitude: 7.7199 },
  { id: "kano-kurmi-market", state: "Kano", city: "Kano", area: "Kurmi Market, Kano", address: "Aminu Kano Way, Kano", latitude: 12.0022, longitude: 8.592 },
  { id: "kano-wapa-market", state: "Kano", city: "Kano", area: "Wapa Market, Kano", address: "France Road, Kano", latitude: 11.9889, longitude: 8.5201 },
  { id: "katsina-katsina-central", state: "Katsina", city: "Katsina", area: "Central Market, Katsina", address: "Ibrahim Babangida Way, Katsina", latitude: 12.9886, longitude: 7.6008 },
  { id: "katsina-daura-main", state: "Katsina", city: "Daura", area: "Daura Main Market", address: "Maiadua Road, Daura, Katsina", latitude: 13.0317, longitude: 8.3235 },
  { id: "kebbi-birnin-kebbi-main", state: "Kebbi", city: "Birnin Kebbi", area: "Central Market, Birnin Kebbi", address: "Ahmadu Bello Way, Birnin Kebbi", latitude: 12.4539, longitude: 4.1978 },
  { id: "kebbi-argungu-main", state: "Kebbi", city: "Argungu", area: "Argungu Main Market", address: "Sokoto Road, Argungu, Kebbi", latitude: 12.7448, longitude: 4.5269 },
  { id: "kogi-lokoja-ganaja", state: "Kogi", city: "Lokoja", area: "Ganaja Junction Market, Lokoja", address: "Lokoja-Ganaja Road, Lokoja, Kogi", latitude: 7.8023, longitude: 6.7338 },
  { id: "kogi-okene-main", state: "Kogi", city: "Okene", area: "Okene Main Market", address: "Abuja Road, Okene, Kogi", latitude: 7.5532, longitude: 6.2359 },
  { id: "kwara-ilorin-ita-ama", state: "Kwara", city: "Ilorin", area: "Ita-Ama Market, Ilorin", address: "Unity Road, Ilorin, Kwara", latitude: 8.4966, longitude: 4.5421 },
  { id: "kwara-offa-owode", state: "Kwara", city: "Offa", area: "Owode Market, Offa", address: "Ojoku Road, Offa, Kwara", latitude: 8.1491, longitude: 4.7207 },
  { id: "lagos-ikeja-city-mall", state: "Lagos", city: "Ikeja", area: "Ikeja City Mall, Alausa", address: "Obafemi Awolowo Way, Alausa, Ikeja, Lagos", latitude: 6.6141, longitude: 3.3571, aliases: ["North Terminal Branch"] },
  { id: "lagos-tejuosho", state: "Lagos", city: "Yaba", area: "Tejuosho Shopping Complex, Yaba", address: "Ojuelegba Road, Yaba, Lagos", latitude: 6.50885, longitude: 3.36968, aliases: ["West Side Hub"] },
  { id: "lagos-tbs-onikan", state: "Lagos", city: "Lagos Island", area: "Tafawa Balewa Square, Onikan", address: "21 Tafawa Balewa Road, Onikan, Lagos Island, Lagos", latitude: 6.44659, longitude: 3.40185, aliases: ["Downtown Financial District"] },
  { id: "lagos-circle-mall", state: "Lagos", city: "Lekki", area: "Circle Mall, Osapa Lekki", address: "Lekki-Epe Expressway, Osapa, Lekki, Lagos", latitude: 6.4544967, longitude: 3.5052199, aliases: ["Eastside Exchange"] },
  { id: "nasarawa-lafia-main", state: "Nasarawa", city: "Lafia", area: "Main Market, Lafia", address: "Jos Road, Lafia, Nasarawa", latitude: 8.4939, longitude: 8.5153 },
  { id: "nasarawa-keffi-main", state: "Nasarawa", city: "Keffi", area: "Keffi Central Market", address: "Jos Road, Keffi, Nasarawa", latitude: 8.8472, longitude: 7.8736 },
  { id: "niger-minna-kure", state: "Niger", city: "Minna", area: "Kure Ultra-Modern Market, Minna", address: "Kure Road, Minna, Niger", latitude: 9.6155, longitude: 6.5569 },
  { id: "niger-bida-small", state: "Niger", city: "Bida", area: "Small Market, Bida", address: "Lemu Road, Bida, Niger", latitude: 9.0804, longitude: 6.0195 },
  { id: "ogun-abeokuta-kuto", state: "Ogun", city: "Abeokuta", area: "Kuto Market, Abeokuta", address: "Presidential Boulevard, Abeokuta, Ogun", latitude: 7.1475, longitude: 3.3619 },
  { id: "ogun-sango-ota-market", state: "Ogun", city: "Ota", area: "Sango Ota Market", address: "Lagos-Abeokuta Expressway, Ota, Ogun", latitude: 6.6756, longitude: 3.2451 },
  { id: "ondo-akure-ojoba", state: "Ondo", city: "Akure", area: "Oja Oba Market, Akure", address: "Oyemekun Road, Akure, Ondo", latitude: 7.2526, longitude: 5.1931 },
  { id: "ondo-ondo-yaba", state: "Ondo", city: "Ondo", area: "Yaba Market, Ondo", address: "Yaba Road, Ondo, Ondo", latitude: 7.0932, longitude: 4.8353 },
  { id: "osun-osogbo-olaiya", state: "Osun", city: "Osogbo", area: "Oja-Oba, Osogbo", address: "Old Garage Road, Osogbo, Osun", latitude: 7.7712, longitude: 4.5562 },
  { id: "osun-ife-mayin", state: "Osun", city: "Ile-Ife", area: "Mayfair Market, Ile-Ife", address: "Mayfair Road, Ile-Ife, Osun", latitude: 7.482, longitude: 4.5603 },
  { id: "oyo-ibadan-dugbe", state: "Oyo", city: "Ibadan", area: "Dugbe Market, Ibadan", address: "Mokola Hill, Dugbe, Ibadan, Oyo", latitude: 7.3812, longitude: 3.9019 },
  { id: "oyo-ibadan-bodija", state: "Oyo", city: "Ibadan", area: "Bodija Market, Ibadan", address: "Secretariat Road, Bodija, Ibadan, Oyo", latitude: 7.4366, longitude: 3.9011 },
  { id: "plateau-jos-terminus", state: "Plateau", city: "Jos", area: "Terminus Market, Jos", address: "Ahmadu Bello Way, Jos, Plateau", latitude: 9.8965, longitude: 8.8583 },
  { id: "plateau-bukuru-main", state: "Plateau", city: "Bukuru", area: "Bukuru Main Market", address: "Vom Road, Bukuru, Plateau", latitude: 9.7938, longitude: 8.8637 },
  { id: "rivers-portharcourt-mile1", state: "Rivers", city: "Port Harcourt", area: "Mile 1 Market, Port Harcourt", address: "Ikwerre Road, Port Harcourt, Rivers", latitude: 4.8156, longitude: 7.0498 },
  { id: "rivers-portharcourt-mile3", state: "Rivers", city: "Port Harcourt", area: "Mile 3 Market, Port Harcourt", address: "Aba Road, Port Harcourt, Rivers", latitude: 4.8317, longitude: 7.0324 },
  { id: "sokoto-sokoto-central", state: "Sokoto", city: "Sokoto", area: "Central Market, Sokoto", address: "Sultan Abubakar Road, Sokoto", latitude: 13.0609, longitude: 5.239 },
  { id: "sokoto-tambuwal-main", state: "Sokoto", city: "Tambuwal", area: "Tambuwal Main Market", address: "Kebbi Road, Tambuwal, Sokoto", latitude: 12.4059, longitude: 4.6481 },
  { id: "taraba-jalingo-main", state: "Taraba", city: "Jalingo", area: "Jalingo Main Market", address: "Hammaruwa Way, Jalingo, Taraba", latitude: 8.8921, longitude: 11.3635 },
  { id: "taraba-wukari-main", state: "Taraba", city: "Wukari", area: "Wukari Main Market", address: "Katsina-Ala Road, Wukari, Taraba", latitude: 7.8525, longitude: 9.7808 },
  { id: "yobe-damaturu-main", state: "Yobe", city: "Damaturu", area: "Damaturu Main Market", address: "Potiskum Road, Damaturu, Yobe", latitude: 11.7444, longitude: 11.9662 },
  { id: "yobe-potiskum-main", state: "Yobe", city: "Potiskum", area: "Potiskum Main Market", address: "Maiduguri Road, Potiskum, Yobe", latitude: 11.7061, longitude: 11.0811 },
  { id: "zamfara-gusau-central", state: "Zamfara", city: "Gusau", area: "Central Market, Gusau", address: "Sokoto Road, Gusau, Zamfara", latitude: 12.1704, longitude: 6.6641 },
  { id: "zamfara-kaura-namoda-main", state: "Zamfara", city: "Kaura Namoda", area: "Kaura Namoda Main Market", address: "Shinkafi Road, Kaura Namoda, Zamfara", latitude: 12.5989, longitude: 6.5864 }
];

// Backward compatibility with existing imports.
export const lagosPickupLocations: PickupLocationOption[] = nigeriaPickupLocations;

const fallbackPickupLocation = nigeriaPickupLocations[0];

function normalizePickupKey(value: string) {
  return value.trim().toLowerCase();
}

export function getPickupLocationById(locationId?: string | null) {
  if (!locationId) {
    return null;
  }

  return nigeriaPickupLocations.find((location) => location.id === locationId.trim()) ?? null;
}

export function listPickupStates() {
  return Array.from(new Set(nigeriaPickupLocations.map((location) => location.state))).sort((left, right) => left.localeCompare(right));
}

export function listPickupCitiesByState(state: string) {
  const normalizedState = normalizePickupKey(state);
  return Array.from(
    new Set(
      nigeriaPickupLocations
        .filter((location) => normalizePickupKey(location.state) === normalizedState)
        .map((location) => location.city)
    )
  ).sort((left, right) => left.localeCompare(right));
}

export function listPickupLocationsByStateCity(state: string, city: string) {
  const normalizedState = normalizePickupKey(state);
  const normalizedCity = normalizePickupKey(city);
  return nigeriaPickupLocations.filter(
    (location) => normalizePickupKey(location.state) === normalizedState && normalizePickupKey(location.city) === normalizedCity
  );
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
    nigeriaPickupLocations.find((location) =>
      [location.area, location.address, location.state, location.city, ...(location.aliases ?? [])].some(
        (entry) => normalizePickupKey(entry) === normalizedValue
      )
    ) ?? null
  );
}

export function resolvePickupLocation(value?: string | null) {
  return findPickupLocation(value) ?? fallbackPickupLocation;
}

export function buildPickupDirectionsUrl(location: PickupLocationOption) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.area}, ${location.address}`)}`;
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
    return `${Math.max(100, Math.round((distanceKm * 1000) / 100) * 100)} m away`;
  }

  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km away`;
}
