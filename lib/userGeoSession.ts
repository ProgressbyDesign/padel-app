const STORAGE_KEY = "padel_user_geo_v1";

export type StoredUserGeo = {
  latitude: number;
  longitude: number;
};

function parseStored(raw: string): StoredUserGeo | null {
  try {
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return null;
    const o = p as Record<string, unknown>;
    const lat = o.latitude;
    const lng = o.longitude;
    if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }
    return { latitude: lat, longitude: lng };
  } catch {
    return null;
  }
}

/** Persist coords after user-triggered geolocation (e.g. hero → /venues handoff). */
export function writeUserGeo(coords: StoredUserGeo): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(coords));
  } catch {
    /* quota / private mode */
  }
}

export function readUserGeo(): StoredUserGeo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseStored(raw);
  } catch {
    return null;
  }
}

export function clearUserGeo(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
