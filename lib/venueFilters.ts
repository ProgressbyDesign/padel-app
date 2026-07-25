/**
 * Example shape (Supabase / API):
 * {
 *   id, name, city, country,
 *   venue_images: [{ url, is_primary, ... }], // managed gallery
 *   image_url: "https://...",      // legacy single hero fallback
 *   main_image: "https://...",     // older optional fallback
 *   images: ["url1", "url2"],      // older optional gallery
 *   courts, court_type, rating, ...
 * }
 */
import type { VenueImageRow } from "./venueImages";
import type { VenueSocialRow } from "./venueSocials";

export type Venue = {
  id: string | number;
  name?: string | null;
  city?: string | null;
  country?: string | null;
  address?: string | null;
  /** Older hero image fallback. */
  main_image?: string | null;
  /** Older gallery URL fallback. */
  images?: string[] | null;
  image_url?: string | null;
  venue_images?: VenueImageRow[] | null;
  venue_socials?: VenueSocialRow[] | null;
  courts?: number | null;
  court_type?: string | null;
  coaching_available?: boolean | null;
  coaching_description?: string | null;
  /** AI-generated or curated venue summary */
  description?: string | null;
  rating?: number | string | null;
  review_count?: number | null;
  premium_training?: boolean | null;
  venue_type?: string | null;
  website?: string | null;
  phone?: string | null;
  opening_hours?: unknown;
  opening_hours_structured?: unknown;
  lat?: number | null;
  lng?: number | null;
  /** Alternate column names (some DB schemas) */
  latitude?: number | string | null;
  longitude?: number | string | null;
  google_place_id?: string | null;
  is_approved?: boolean | null;
};

export type VenueTypeFilter = "premium_training" | "casual" | "resort";
export type CourtEnvironmentFilter = "all" | "indoor" | "outdoor";
export type MinCourtsFilter = 0 | 4 | 6 | 8;

export type FilterState = {
  /** City / country (Where field). */
  locationQuery: string;
  /** Venue name (Venue field on venue PLP). */
  venueQuery: string;
  environment: CourtEnvironmentFilter;
  minCourts: MinCourtsFilter;
};

export const defaultFilters: FilterState = {
  locationQuery: "",
  venueQuery: "",
  environment: "all",
  minCourts: 0,
};

/** Badge count for venue filters modal (playing conditions + min courts). */
export function countVenueModalFiltersActive(
  f: Pick<FilterState, "environment" | "minCourts">
): number {
  let n = 0;
  if (f.environment !== "all") n += 1;
  if (f.minCourts > 0) n += 1;
  return n;
}

/** True if venue city/country matches search (exact preferred; includes for partial). */
export function matchesLocationQuery(venue: Venue, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const city = (venue.city ?? "").trim();
  const country = (venue.country ?? "").trim();
  const cityL = city.toLowerCase();
  const countryL = country.toLowerCase();
  const lineL = `${city}, ${country}`.toLowerCase();

  if (cityL === q || countryL === q || lineL === q) return true;
  if (cityL.includes(q) || countryL.includes(q) || lineL.includes(q)) return true;
  return false;
}

export function normalizeSurfaceType(raw?: string | null): "indoor" | "outdoor" | "unknown" {
  if (!raw) return "unknown";
  const value = raw.toLowerCase();
  if (value.includes("indoor")) return "indoor";
  if (value.includes("outdoor")) return "outdoor";
  return "unknown";
}

export function normalizeVenueType(venue: Venue): VenueTypeFilter {
  const raw = venue.venue_type?.toLowerCase();
  if (raw === "premium_training" || raw === "casual" || raw === "resort") return raw;
  if (venue.premium_training) return "premium_training";
  return "casual";
}

function normalizeText(value?: string | null) {
  const cleaned = value?.trim();
  return cleaned && cleaned.length > 0 ? cleaned : null;
}

export function getCountryOptions(venues: Venue[]): string[] {
  return [...new Set(venues.map((venue) => normalizeText(venue.country)).filter(Boolean) as string[])].sort(
    (a, b) => a.localeCompare(b)
  );
}

export function getCityOptions(venues: Venue[], country: string): string[] {
  const filteredByCountry = country === "all" ? venues : venues.filter((venue) => venue.country === country);
  return [
    ...new Set(filteredByCountry.map((venue) => normalizeText(venue.city)).filter(Boolean) as string[]),
  ].sort((a, b) => a.localeCompare(b));
}

/** Single "Where" combobox: countries first, then city + country pairs (unique). */
export type WhereOption =
  | { id: string; kind: "country"; country: string; label: string }
  | { id: string; kind: "city"; country: string; city: string; label: string };

/** Countries always offered in location search even when no venue row exists yet. */
const SUGGESTED_COUNTRY_LABELS = ["Sweden"] as const;

function prependSuggestedCountries(options: WhereOption[]): WhereOption[] {
  const have = new Set(
    options
      .filter((o): o is WhereOption & { kind: "country" } => o.kind === "country")
      .map((o) => o.country.toLowerCase())
  );
  const prepend: WhereOption[] = [];
  for (const country of SUGGESTED_COUNTRY_LABELS) {
    if (!have.has(country.toLowerCase())) {
      prepend.push({
        id: `country:${country}`,
        kind: "country",
        country,
        label: country,
      });
    }
  }
  return prepend.length > 0 ? [...prepend, ...options] : options;
}

export function buildWhereOptions(venues: Venue[]): WhereOption[] {
  const countries = getCountryOptions(venues);
  const seen = new Set<string>();
  const cityRows: Array<{ country: string; city: string }> = [];
  for (const v of venues) {
    const country = normalizeText(v.country);
    const city = normalizeText(v.city);
    if (country && city) {
      const key = `${country}\0${city}`;
      if (!seen.has(key)) {
        seen.add(key);
        cityRows.push({ country, city });
      }
    }
  }
  cityRows.sort((a, b) => {
    const byCity = a.city.localeCompare(b.city);
    if (byCity !== 0) return byCity;
    return a.country.localeCompare(b.country);
  });

  const countryOpts: WhereOption[] = countries.map((country) => ({
    id: `country:${country}`,
    kind: "country",
    country,
    label: country,
  }));
  const cityOpts: WhereOption[] = cityRows.map(({ country, city }) => ({
    id: `city:${country}:${city}`,
    kind: "city",
    country,
    city,
    label: `${city}, ${country}`,
  }));
  return prependSuggestedCountries([...countryOpts, ...cityOpts]);
}

/** True when the DB marks the venue as premium training (boolean and/or venue_type). */
export function isPremiumTrainingVenue(venue: Venue): boolean {
  if (venue.premium_training) return true;
  return normalizeVenueType(venue) === "premium_training";
}

function coachingScore(venue: Venue): number {
  return venue.coaching_available ? 1 : 0;
}

export type SortBy = "best_match" | "rating" | "courts" | "distance";
export type SortDirection = "desc" | "asc";

function parseRatingValue(raw: Venue["rating"]): number | null {
  const n = typeof raw === "string" ? Number(raw) : raw;
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  return n;
}

function compareName(a: Venue, b: Venue): number {
  const nameA = String(a.name ?? "").trim();
  const nameB = String(b.name ?? "").trim();
  return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
}

/**
 * Apply user-selected sort. `best_match` uses courts + coaching + premium_training.
 * Rating/courts respect `direction` (desc = highest/most first).
 */
function distanceMilesOnVenue(venue: Venue & { distance?: number }): number | null {
  return typeof venue.distance === "number" && Number.isFinite(venue.distance) ? venue.distance : null;
}

export function sortVenuesByUserChoice<T extends Venue>(
  venues: T[],
  sortBy: SortBy,
  direction: SortDirection
): T[] {
  if (sortBy === "best_match") return sortVenuesByBestMatch(venues);

  const list = [...venues];

  if (sortBy === "distance") {
    return list.sort((a, b) => {
      const da = distanceMilesOnVenue(a as Venue & { distance?: number });
      const db = distanceMilesOnVenue(b as Venue & { distance?: number });
      if (da == null && db == null) return compareName(a, b);
      if (da == null) return 1;
      if (db == null) return -1;
      const cmp = direction === "asc" ? da - db : db - da;
      if (cmp !== 0) return cmp;
      return compareName(a, b);
    });
  }

  if (sortBy === "courts") {
    return list.sort((a, b) => {
      const ca = typeof a.courts === "number" ? a.courts : 0;
      const cb = typeof b.courts === "number" ? b.courts : 0;
      const cmp = direction === "desc" ? cb - ca : ca - cb;
      if (cmp !== 0) return cmp;
      return compareName(a, b);
    });
  }

  return list.sort((a, b) => {
    const ra = parseRatingValue(a.rating);
    const rb = parseRatingValue(b.rating);
    const aN = ra === null ? (direction === "desc" ? -Infinity : Infinity) : ra;
    const bN = rb === null ? (direction === "desc" ? -Infinity : Infinity) : rb;
    const cmp = direction === "desc" ? bN - aN : aN - bN;
    if (cmp !== 0) return cmp;
    return compareName(a, b);
  });
}

/** Higher = better match: more courts, coaching preferred, premium_training preferred. */
export function sortVenuesByBestMatch<T extends Venue>(venues: T[]): T[] {
  return [...venues].sort((a, b) => {
    const courtsA = typeof a.courts === "number" ? a.courts : 0;
    const courtsB = typeof b.courts === "number" ? b.courts : 0;
    if (courtsB !== courtsA) return courtsB - courtsA;

    const coachDiff = coachingScore(b) - coachingScore(a);
    if (coachDiff !== 0) return coachDiff;

    const premA = isPremiumTrainingVenue(a) ? 1 : 0;
    const premB = isPremiumTrainingVenue(b) ? 1 : 0;
    if (premB !== premA) return premB - premA;

    const nameA = String(a.name ?? "").trim();
    const nameB = String(b.name ?? "").trim();
    return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
  });
}

export function filterVenues<T extends Venue>(venues: T[], filters: FilterState): T[] {
  return venues.filter((venue) => {
    if (!matchesLocationQuery(venue, filters.locationQuery)) return false;

    if (filters.environment !== "all" && normalizeSurfaceType(venue.court_type) !== filters.environment) {
      return false;
    }

    if (filters.minCourts > 0 && (typeof venue.courts !== "number" || venue.courts < filters.minCourts)) {
      return false;
    }

    return true;
  });
}
