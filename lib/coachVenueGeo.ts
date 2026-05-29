/**
 * Coach geography is derived from `coach_venues` → `venues` (primary link first).
 * Venues own city, country, and coordinates.
 */

/** PostgREST embed fragment — append to `coaches` selects. */
export const COACH_VENUES_WITH_VENUE_SELECT = `
  coach_venues (
    is_primary,
    venue_id,
    venues (
      id,
      name,
      city,
      country,
      lat,
      lng
    )
  )
`;

export type VenueGeoRow = {
  id?: string | number;
  name?: string | null;
  city?: string | null;
  country?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  /** Present when DB uses latitude/longitude column names */
  latitude?: number | string | null;
  longitude?: number | string | null;
};

export type CoachVenueLinkRow = {
  is_primary?: boolean | null;
  venue_id?: string | null;
  venues?: VenueGeoRow | VenueGeoRow[] | null;
};

export type CoachWithVenueLinks = {
  coach_venues?: CoachVenueLinkRow[] | null;
};

export function normalizeEmbeddedVenue(
  v: VenueGeoRow | VenueGeoRow[] | null | undefined
): VenueGeoRow | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export function pickPrimaryCoachVenueLink(
  links: CoachVenueLinkRow[] | null | undefined
): CoachVenueLinkRow | null {
  if (!links?.length) return null;
  return links.find((l) => l.is_primary === true) ?? links[0] ?? null;
}

/** Primary venue row (`is_primary = true`, else first link). */
export function pickPrimaryVenueFromCoachRow(row: CoachWithVenueLinks): VenueGeoRow | null {
  const link = pickPrimaryCoachVenueLink(row.coach_venues ?? null);
  if (!link) return null;
  return normalizeEmbeddedVenue(link.venues);
}

function toFiniteCoord(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function venueCoordPair(v: VenueGeoRow | null): {
  lat: number | null;
  lng: number | null;
} {
  if (!v) return { lat: null, lng: null };
  const lat = toFiniteCoord(v.lat ?? v.latitude);
  const lng = toFiniteCoord(v.lng ?? v.longitude);
  return { lat, lng };
}

export function venueLocationLabels(v: VenueGeoRow | null): {
  city: string | null;
  country: string | null;
  full: string;
} {
  const city = v?.city?.trim() || null;
  const country = v?.country?.trim() || null;
  const full = [city, country].filter(Boolean).join(", ");
  return { city, country, full };
}

/** PLP location line: primary venue, or "Multiple locations" when cities differ. */
export function listingLocationFromCoachRow(row: CoachWithVenueLinks): {
  city: string;
  country: string;
} {
  const links = row.coach_venues ?? [];
  const cities = new Set<string>();
  const countries = new Set<string>();

  for (const link of links) {
    const v = normalizeEmbeddedVenue(link.venues);
    const city = v?.city?.trim();
    const country = v?.country?.trim();
    if (city) cities.add(city);
    if (country) countries.add(country);
  }

  if (cities.size > 1) {
    return { city: "Multiple locations", country: "" };
  }

  const primary = pickPrimaryVenueFromCoachRow(row);
  const { city, country } = venueLocationLabels(primary);
  return { city: city ?? "", country: country ?? "" };
}
