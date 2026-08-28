import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import { LISTING_PAGE_SIZE } from "../constants/listings";
import {
  coachesRowsToListingItems,
  playerLevelValueForSkillFilter,
  sortCoachListing,
  type CoachListingItem,
  type CoachListingSort,
} from "../coachListing";
import type { CoachSkillLevel } from "../coaches";
import { hydrateCoachVenueEmbeds } from "../hydrateCoachVenues";
import { PUBLIC_COACH_VENUE_STATUSES } from "../lifecycle/constants";
import { applyPublishedCoachFilter, applyPublishedVenueFilter } from "../lifecycle/publicationFilters";
import { clampPage, listingPageCount } from "../listingUrlParams";
import {
  COACH_PUBLIC_PROFILES_TABLE,
  PUBLIC_COACH_SELECT,
  VENUE_PUBLIC_PROFILES_TABLE,
  asPublicRows,
  type PublicCoachRow,
} from "../publicProfiles";
import { normalizeSearchKey, searchMatchScore } from "../searchFuzzy";
import { createClient } from "../supabase/server";
import type { Venue } from "../venueFilters";
import { hydratePublicCoachRows } from "./hydratePublicCoaches";

export type CoachListingQueryInput = {
  page: number;
  pageSize?: number;
  location?: string;
  coach?: string;
  /** @deprecated use location + coach */
  search?: string;
  level?: "all" | CoachSkillLevel;
  audienceAdults?: boolean;
  audienceJuniors?: boolean;
  travelOnly?: boolean;
  sort?: CoachListingSort;
  nearLat?: number | null;
  nearLng?: number | null;
};

export type CoachListingQueryResult = {
  coaches: CoachListingItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** Coach IDs with an outcome label matching the normalized query. */
async function coachIdsMatchingOutcomeSearch(search: string): Promise<string[]> {
  const supabase = await createClient();
  const key = normalizeSearchKey(search);
  if (!key) return [];

  const { data, error } = await supabase
    .from("coach_outcomes")
    .select("coach_id, outcome, outcome_key")
    .limit(300);
  if (error || !data?.length) return [];

  const seen = new Set<string>();
  const ids: string[] = [];
  for (const row of data) {
    const outcome = row.outcome?.trim() ?? "";
    const outcomeKey = (row as { outcome_key?: string | null }).outcome_key?.trim() ?? "";
    const haystack = `${outcome} ${outcomeKey}`.trim();
    if (!haystack || searchMatchScore(search, haystack) <= 0) continue;
    const id = String(row.coach_id);
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/** Coach IDs linked to venues matching a normalized location/search key. */
async function coachIdsMatchingVenueSearch(search: string): Promise<string[]> {
  const supabase = await createClient();
  const key = normalizeSearchKey(search);
  if (!key) return [];

  let venuesQuery = supabase
    .from(VENUE_PUBLIC_PROFILES_TABLE)
    .select("id")
    .ilike("search_key", `%${key}%`);
  venuesQuery = applyPublishedVenueFilter(venuesQuery);
  const { data: venues, error } = await venuesQuery;

  if (error || !venues?.length) return [];

  const venueIds = venues.map((v) => v.id);
  const { data: links, error: linkErr } = await supabase
    .from("coach_venues")
    .select("coach_id")
    .in("venue_id", venueIds)
    .in("status", [...PUBLIC_COACH_VENUE_STATUSES]);

  if (linkErr || !links?.length) return [];

  return [...new Set(links.map((l) => String((l as { coach_id: string }).coach_id)))];
}

/** Coach IDs with structured locations matching city/country text. */
async function coachIdsMatchingCoachLocationSearch(search: string): Promise<string[]> {
  const supabase = await createClient();
  const key = normalizeSearchKey(search);
  if (!key) return [];

  const pattern = `%${key}%`;
  const { data, error } = await supabase
    .from("coach_locations")
    .select("coach_id, city, country")
    .or(`city.ilike.${JSON.stringify(pattern)},country.ilike.${JSON.stringify(pattern)}`)
    .limit(400);

  if (error || !data?.length) {
    const fallback = await supabase
      .from("coach_locations")
      .select("coach_id, city, country")
      .ilike("city", pattern)
      .limit(400);
    if (fallback.error || !fallback.data?.length) return [];
    return [
      ...new Set(fallback.data.map((row) => String((row as { coach_id: string }).coach_id))),
    ];
  }

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const row of data) {
    const city = (row as { city?: string | null }).city ?? "";
    const country = (row as { country?: string | null }).country ?? "";
    if (searchMatchScore(search, city, country) <= 0) continue;
    const id = String((row as { coach_id: string }).coach_id);
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

async function coachIdsMatchingLocationSearch(search: string): Promise<string[]> {
  const [venueIds, locationIds] = await Promise.all([
    coachIdsMatchingVenueSearch(search),
    coachIdsMatchingCoachLocationSearch(search),
  ]);
  return [...new Set([...venueIds, ...locationIds])];
}

async function coachIdsMatchingAttributeAudience(
  input: CoachListingQueryInput
): Promise<string[] | null> {
  if (!input.audienceAdults && !input.audienceJuniors) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_attributes")
    .select("coach_id, audience_adults, audience_juniors");
  if (error || !data?.length) return [];
  const ids: string[] = [];
  for (const row of data) {
    const adults = Boolean((row as { audience_adults?: boolean }).audience_adults);
    const juniors = Boolean((row as { audience_juniors?: boolean }).audience_juniors);
    if (input.audienceAdults && input.audienceJuniors) {
      if (!adults && !juniors) continue;
    } else if (input.audienceAdults && !adults) continue;
    else if (input.audienceJuniors && !juniors) continue;
    ids.push(String((row as { coach_id: string }).coach_id));
  }
  return ids;
}

async function coachIdsMatchingAttributePlayerLevel(
  level: CoachSkillLevel
): Promise<string[]> {
  const playerLevel = playerLevelValueForSkillFilter(level);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_attributes")
    .select("coach_id, player_levels");
  if (error || !data?.length) return [];
  const ids: string[] = [];
  for (const row of data) {
    const levels = (row as { player_levels?: string[] | null }).player_levels ?? [];
    if (levels.includes(playerLevel)) {
      ids.push(String((row as { coach_id: string }).coach_id));
    }
  }
  return ids;
}

function applyCoachFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: PostgrestFilterBuilder<any, any, any, any, any>,
  input: CoachListingQueryInput,
  locationCoachIds: string[] | null,
  goalCoachIds: string[] | null,
  audienceCoachIds: string[] | null,
  levelAttributeIds: string[]
) {
  const coachName = (input.coach ?? "").trim();
  const coachKey = coachName ? normalizeSearchKey(coachName) : "";

  if (coachKey) {
    const ids = goalCoachIds ?? [];
    if (ids.length > 0) {
      query = query.or(`search_key.ilike.%${coachKey}%,id.in.(${ids.join(",")})`);
    } else {
      query = query.ilike("search_key", `%${coachKey}%`);
    }
  } else if (goalCoachIds?.length) {
    query = query.in("id", goalCoachIds);
  }

  if (locationCoachIds) {
    if (locationCoachIds.length === 0) {
      return { query, empty: true as const };
    }
    query = query.in("id", locationCoachIds);
  }

  if (audienceCoachIds) {
    if (audienceCoachIds.length === 0) {
      return { query, empty: true as const };
    }
    query = query.in("id", audienceCoachIds);
  }

  if (input.level && input.level !== "all") {
    if (levelAttributeIds.length > 0) {
      query = query.or(`level.eq.${input.level},id.in.(${levelAttributeIds.join(",")})`);
    } else {
      query = query.eq("level", input.level);
    }
  }

  if (input.travelOnly) {
    query = query.eq("travel_available", true);
  }

  return { query, empty: false as const };
}

function applyCoachSort(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: PostgrestFilterBuilder<any, any, any, any, any>,
  sort: CoachListingSort
) {
  if (sort === "experience") {
    return query
      .order("experience_years", { ascending: false, nullsFirst: false })
      .order("rating", { ascending: false, nullsFirst: false });
  }
  if (sort === "rating") {
    return query
      .order("rating", { ascending: false, nullsFirst: false })
      .order("review_count", { ascending: false, nullsFirst: false });
  }
  return query
    .order("rating", { ascending: false, nullsFirst: false })
    .order("review_count", { ascending: false, nullsFirst: false })
    .order("experience_years", { ascending: false, nullsFirst: false });
}

/** Paginated coach PLP — filters and search against full database. */
export async function fetchCoachListingPage(
  input: CoachListingQueryInput
): Promise<CoachListingQueryResult> {
  const supabase = await createClient();
  const pageSize = input.pageSize ?? LISTING_PAGE_SIZE;
  const sort = input.sort ?? "recommended";

  const location =
    (input.location ?? "").trim() || (input.search ?? "").trim();
  const coachGoal = (input.coach ?? "").trim();
  const locationCoachIds = location ? await coachIdsMatchingLocationSearch(location) : null;
  const goalCoachIds = coachGoal ? await coachIdsMatchingOutcomeSearch(coachGoal) : null;
  const audienceCoachIds = await coachIdsMatchingAttributeAudience(input);
  const levelAttributeIds =
    input.level && input.level !== "all"
      ? await coachIdsMatchingAttributePlayerLevel(input.level)
      : [];

  let countQuery = supabase
    .from(COACH_PUBLIC_PROFILES_TABLE)
    .select("id", { count: "exact", head: true });
  countQuery = applyPublishedCoachFilter(countQuery);
  const countFiltered = applyCoachFilters(
    countQuery,
    input,
    locationCoachIds,
    goalCoachIds,
    audienceCoachIds,
    levelAttributeIds
  );
  if (countFiltered.empty) {
    return { coaches: [], totalCount: 0, page: 1, pageSize, totalPages: 1 };
  }
  const countRes = await countFiltered.query;
  const totalCount =
    !countRes.error && typeof countRes.count === "number" ? countRes.count : 0;
  const totalPages = listingPageCount(totalCount, pageSize);
  const page = clampPage(input.page, totalPages);

  if (totalCount === 0) {
    return { coaches: [], totalCount: 0, page: 1, pageSize, totalPages: 1 };
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const useDistanceSort =
    sort === "distance" &&
    input.nearLat != null &&
    input.nearLng != null &&
    Number.isFinite(input.nearLat) &&
    Number.isFinite(input.nearLng);

  let dataQuery = supabase.from(COACH_PUBLIC_PROFILES_TABLE).select(PUBLIC_COACH_SELECT);
  dataQuery = applyPublishedCoachFilter(dataQuery);
  const dataFiltered = applyCoachFilters(
    dataQuery,
    input,
    locationCoachIds,
    goalCoachIds,
    audienceCoachIds,
    levelAttributeIds
  );
  if (dataFiltered.empty) {
    return { coaches: [], totalCount: 0, page: 1, pageSize, totalPages: 1 };
  }

  if (!useDistanceSort) {
    dataQuery = applyCoachSort(dataFiltered.query, sort);
  } else {
    dataQuery = dataFiltered.query;
  }

  const { data, error } = useDistanceSort
    ? await dataQuery
    : await dataQuery.range(from, to);

  if (error) {
    console.warn("[coaches] listing page failed:", error.message);
    return { coaches: [], totalCount: 0, page: 1, pageSize, totalPages: 1 };
  }

  const cores = asPublicRows<PublicCoachRow>(data);
  const rows = await hydratePublicCoachRows(supabase, cores);
  let venuesQuery = supabase
    .from(VENUE_PUBLIC_PROFILES_TABLE)
    .select("id, city, country, lat, lng")
    .limit(500);
  venuesQuery = applyPublishedVenueFilter(venuesQuery);
  const venuesRes = await venuesQuery;
  const venues = asPublicRows<{
    id?: string;
    city?: string | null;
    country?: string | null;
    lat?: number | null;
    lng?: number | null;
  }>(venuesRes.data).map((row) => ({
    id: String(row.id),
    city: row.city,
    country: row.country,
    lat: row.lat,
    lng: row.lng,
  })) as Venue[];
  const hydrated = hydrateCoachVenueEmbeds(rows, venues);
  let coaches = coachesRowsToListingItems(hydrated);

  if (useDistanceSort) {
    coaches = sortCoachListing(
      coaches.map((c) => ({
        ...c,
        distance: coachDistanceMiles(c, input.nearLat!, input.nearLng!),
      })),
      "distance"
    );
    coaches = coaches.slice(from, to + 1);
  }

  return {
    coaches,
    totalCount,
    page,
    pageSize,
    totalPages,
  };
}

function coachDistanceMiles(c: CoachListingItem, lat0: number, lng0: number): number | undefined {
  const lat = typeof c.locationLat === "number" ? c.locationLat : Number(c.locationLat);
  const lng = typeof c.locationLng === "number" ? c.locationLng : Number(c.locationLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  const R = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat - lat0);
  const dLng = toRad(lng - lng0);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat0)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
  const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(km * 0.621371);
}
