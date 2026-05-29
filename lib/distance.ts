import type { CoachListingItem } from "./coachListing";
import type { Venue } from "./venueFilters";

export type VenueWithDistance = Venue & { distance?: number };

export function getDistanceInMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // km
  const toRad = (value: number) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const km = R * c;
  const miles = km * 0.621371;

  return Math.round(miles);
}

function toFiniteCoord(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function venueLatLng(v: Venue): { lat: number; lng: number } | null {
  const lat = toFiniteCoord(v.lat ?? v.latitude);
  const lng = toFiniteCoord(v.lng ?? v.longitude);
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

/** Enriches venues with `distance` (miles, rounded) when user coordinates are known. */
export function addDistancesToVenues(
  venues: Venue[],
  user: { latitude: number; longitude: number } | null
): VenueWithDistance[] {
  if (!user) {
    return venues.map((v) => ({ ...v }));
  }

  const { latitude: lat1, longitude: lng1 } = user;

  return venues.map((v) => {
    const coords = venueLatLng(v);
    if (!coords) {
      return { ...v };
    }
    return { ...v, distance: getDistanceInMiles(lat1, lng1, coords.lat, coords.lng) };
  });
}

export type CoachListingWithDistance = CoachListingItem & { distance?: number };

function coachCoord(lat: CoachListingItem["locationLat"], lng: CoachListingItem["locationLng"]): {
  lat: number;
  lng: number;
} | null {
  const la = typeof lat === "number" ? lat : lat != null ? Number(lat) : NaN;
  const ln = typeof lng === "number" ? lng : lng != null ? Number(lng) : NaN;
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  return { lat: la, lng: ln };
}

/** Uses primary linked venue coordinates on each coach listing item. */
export function addDistancesToCoaches(
  coaches: CoachListingItem[],
  user: { latitude: number; longitude: number } | null
): CoachListingWithDistance[] {
  if (!user) {
    return coaches.map((c) => ({ ...c }));
  }

  const { latitude: lat1, longitude: lng1 } = user;

  return coaches.map((c) => {
    const coords = coachCoord(c.locationLat, c.locationLng);
    if (!coords) {
      return { ...c };
    }
    return {
      ...c,
      distance: getDistanceInMiles(lat1, lng1, coords.lat, coords.lng),
    };
  });
}
