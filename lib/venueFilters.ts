export type Venue = {
  id: string | number;
  name?: string | null;
  city?: string | null;
  country?: string | null;
  address?: string | null;
  image_url?: string | null;
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
  lat?: number | null;
  lng?: number | null;
  google_place_id?: string | null;
};

export type VenueTypeFilter = "premium_training" | "casual" | "resort";
export type CourtEnvironmentFilter = "all" | "indoor" | "outdoor";
export type MinCourtsFilter = 0 | 4 | 6 | 8;

export type FilterState = {
  /** Free-text location: filters by matching city / country (forgiving partial match). */
  locationQuery: string;
  environment: CourtEnvironmentFilter;
  minCourts: MinCourtsFilter;
  coachingOnly: boolean;
  venueTypes: VenueTypeFilter[];
};

export const defaultFilters: FilterState = {
  locationQuery: "",
  environment: "all",
  minCourts: 0,
  coachingOnly: false,
  venueTypes: [],
};

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
  return [...countryOpts, ...cityOpts];
}

/** True when the DB marks the venue as premium training (boolean and/or venue_type). */
export function isPremiumTrainingVenue(venue: Venue): boolean {
  if (venue.premium_training) return true;
  return normalizeVenueType(venue) === "premium_training";
}

function coachingScore(venue: Venue): number {
  return venue.coaching_available ? 1 : 0;
}

export type SortBy = "best_match" | "rating" | "courts";
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
export function sortVenuesByUserChoice(venues: Venue[], sortBy: SortBy, direction: SortDirection): Venue[] {
  if (sortBy === "best_match") return sortVenuesByBestMatch(venues);

  const list = [...venues];

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
export function sortVenuesByBestMatch(venues: Venue[]): Venue[] {
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

export function filterVenues(venues: Venue[], filters: FilterState): Venue[] {
  return venues.filter((venue) => {
    if (!matchesLocationQuery(venue, filters.locationQuery)) return false;

    if (filters.environment !== "all" && normalizeSurfaceType(venue.court_type) !== filters.environment) {
      return false;
    }

    if (filters.minCourts > 0 && (typeof venue.courts !== "number" || venue.courts < filters.minCourts)) {
      return false;
    }

    if (filters.coachingOnly && !venue.coaching_available) return false;

    if (filters.venueTypes.length > 0 && !filters.venueTypes.includes(normalizeVenueType(venue))) {
      return false;
    }

    return true;
  });
}
