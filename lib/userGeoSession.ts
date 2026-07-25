const STORAGE_KEY = "padel_user_geo_v1";

export type StoredUserGeo = {
  latitude: number;
  longitude: number;
};

let cachedRaw: string | null | undefined = undefined;
let cachedParsed: StoredUserGeo | null = null;
const geoListeners = new Set<() => void>();

function notifyUserGeoListeners() {
  geoListeners.forEach((listener) => listener());
}

function parseStored(raw: string): StoredUserGeo | null {
  try {
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return null;
    const o = p as Record<string, unknown>;
    const lat = o.latitude;
    const lng = o.longitude;
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return null;
    }
    return { latitude: lat, longitude: lng };
  } catch {
    return null;
  }
}

function readCached(): StoredUserGeo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedParsed;
    cachedRaw = raw;
    cachedParsed = raw ? parseStored(raw) : null;
    return cachedParsed;
  } catch {
    cachedRaw = null;
    cachedParsed = null;
    return null;
  }
}

/** Persist coords after user-triggered geolocation (e.g. hero → /venues handoff). */
export function writeUserGeo(coords: StoredUserGeo): void {
  if (typeof window === "undefined") return;
  try {
    const raw = JSON.stringify(coords);
    sessionStorage.setItem(STORAGE_KEY, raw);
    cachedRaw = raw;
    cachedParsed = coords;
    notifyUserGeoListeners();
  } catch {
    /* quota / private mode */
  }
}

export function readUserGeo(): StoredUserGeo | null {
  return readCached();
}

export function clearUserGeo(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    cachedRaw = null;
    cachedParsed = null;
    notifyUserGeoListeners();
  } catch {
    /* ignore */
  }
}

/** Subscribe for useSyncExternalStore (same-tab writes via writeUserGeo/clearUserGeo). */
export function subscribeUserGeo(onStoreChange: () => void): () => void {
  geoListeners.add(onStoreChange);
  return () => {
    geoListeners.delete(onStoreChange);
  };
}

export function getUserGeoSnapshot(): StoredUserGeo | null {
  return readCached();
}

export function getUserGeoServerSnapshot(): StoredUserGeo | null {
  return null;
}
