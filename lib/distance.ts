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

function toFiniteCoord(value: Venue["lat"] | Venue["lng"]): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
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
    const lat2 = toFiniteCoord(v.lat);
    const lng2 = toFiniteCoord(v.lng);
    if (lat2 == null || lng2 == null) {
      return { ...v };
    }
    return { ...v, distance: getDistanceInMiles(lat1, lng1, lat2, lng2) };
  });
}
