import type { CoachListingSort } from "./coachListing";
import type { CoachSkillLevel } from "./coaches";
import { fromSearchParamSlug } from "./marketplaceSearch";
import type { CourtEnvironmentFilter, FilterState, MinCourtsFilter, SortBy, SortDirection } from "./venueFilters";
import { LISTING_PAGE_SIZE } from "./constants/listings";

function resolveEntityParam(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (t.includes(" ") || t.includes(",")) return t;
  return fromSearchParamSlug(t) || t;
}

export function firstQueryString(v: string | string[] | undefined): string {
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v) && v[0]) return String(v[0]).trim();
  return "";
}

export function parsePositiveInt(raw: string, fallback: number): number {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export type VenueListingUrlState = {
  page: number;
  filters: FilterState;
  sortBy: SortBy;
  sortDirection: SortDirection;
  location: string;
  venue: string;
  /** @deprecated Combined legacy param */
  search: string;
};

export function parseVenueListingParams(
  sp: Record<string, string | string[] | undefined>
): VenueListingUrlState {
  const page = parsePositiveInt(firstQueryString(sp.page), 1);
  const location =
    firstQueryString(sp.location) ||
    (() => {
      const city = firstQueryString(sp.city);
      const country = firstQueryString(sp.country);
      if (city && country) return `${city}, ${country}`;
      if (country) return country;
      if (city) return city;
      return "";
    })() ||
    firstQueryString(sp.search);

  const venue = resolveEntityParam(firstQueryString(sp.venue));

  const environmentRaw = firstQueryString(sp.environment);
  const environment: CourtEnvironmentFilter =
    environmentRaw === "indoor" || environmentRaw === "outdoor" ? environmentRaw : "all";

  const minCourtsRaw = parsePositiveInt(firstQueryString(sp.minCourts), 0);
  const minCourts: MinCourtsFilter =
    minCourtsRaw === 4 || minCourtsRaw === 6 || minCourtsRaw === 8 ? minCourtsRaw : 0;

  const sortByRaw = firstQueryString(sp.sort);
  const sortBy: SortBy =
    sortByRaw === "rating" || sortByRaw === "courts" || sortByRaw === "distance" ? sortByRaw : "best_match";

  const sortDirRaw = firstQueryString(sp.order);
  const sortDirection: SortDirection = sortDirRaw === "asc" ? "asc" : "desc";

  return {
    page,
    location,
    venue,
    search: [location, venue].filter(Boolean).join(" ").trim(),
    sortBy,
    sortDirection,
    filters: {
      locationQuery: location,
      venueQuery: venue,
      environment,
      minCourts,
    },
  };
}

export type CoachListingUrlState = {
  page: number;
  location: string;
  coach: string;
  /** @deprecated Legacy combined */
  search: string;
  level: "all" | CoachSkillLevel;
  audienceAdults: boolean;
  audienceJuniors: boolean;
  travelOnly: boolean;
  sort: CoachListingSort;
};

export function parseCoachListingParams(
  sp: Record<string, string | string[] | undefined>
): CoachListingUrlState {
  const page = parsePositiveInt(firstQueryString(sp.page), 1);
  const location = firstQueryString(sp.location) || firstQueryString(sp.search);
  const coach = resolveEntityParam(firstQueryString(sp.coach));

  const levelRaw = firstQueryString(sp.level);
  const level: CoachListingUrlState["level"] =
    levelRaw === "Beginner" ||
    levelRaw === "Intermediate" ||
    levelRaw === "Advanced" ||
    levelRaw === "Pro"
      ? levelRaw
      : "all";

  const audience = firstQueryString(sp.audience);
  const audienceAdults = audience.includes("adults") || firstQueryString(sp.adults) === "1";
  const audienceJuniors = audience.includes("juniors") || firstQueryString(sp.juniors) === "1";

  const sortRaw = firstQueryString(sp.sort);
  const sort: CoachListingSort =
    sortRaw === "rating" || sortRaw === "experience" || sortRaw === "distance"
      ? sortRaw
      : "recommended";

  return {
    page,
    location,
    coach,
    search: [location, coach].filter(Boolean).join(" ").trim(),
    level,
    audienceAdults,
    audienceJuniors,
    travelOnly: firstQueryString(sp.travel) === "1",
    sort,
  };
}

export function buildVenueListingQuery(
  state: VenueListingUrlState,
  extra?: { lat?: string; lng?: string }
): URLSearchParams {
  const q = new URLSearchParams();
  if (state.page > 1) q.set("page", String(state.page));
  if (state.location.trim()) q.set("location", state.location.trim());
  if (state.venue.trim()) q.set("venue", state.venue.trim());
  if (state.filters.environment !== "all") q.set("environment", state.filters.environment);
  if (state.filters.minCourts > 0) q.set("minCourts", String(state.filters.minCourts));
  if (state.sortBy !== "best_match") q.set("sort", state.sortBy);
  if (state.sortDirection !== "desc") q.set("order", state.sortDirection);
  if (extra?.lat) q.set("lat", extra.lat);
  if (extra?.lng) q.set("lng", extra.lng);
  return q;
}

export function buildCoachListingQuery(
  state: CoachListingUrlState,
  extra?: { lat?: string; lng?: string }
): URLSearchParams {
  const q = new URLSearchParams();
  if (state.page > 1) q.set("page", String(state.page));
  if (state.location.trim()) q.set("location", state.location.trim());
  if (state.coach.trim()) q.set("coach", state.coach.trim());
  if (state.level !== "all") q.set("level", state.level);
  if (state.audienceAdults) q.set("adults", "1");
  if (state.audienceJuniors) q.set("juniors", "1");
  if (state.travelOnly) q.set("travel", "1");
  if (state.sort !== "recommended") q.set("sort", state.sort);
  if (extra?.lat) q.set("lat", extra.lat);
  if (extra?.lng) q.set("lng", extra.lng);
  return q;
}

export function listingPageCount(totalCount: number, pageSize: number = LISTING_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(totalCount / pageSize));
}

export function clampPage(page: number, totalPages: number): number {
  return Math.min(Math.max(1, page), Math.max(1, totalPages));
}
