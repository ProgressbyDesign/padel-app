import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import { LISTING_PAGE_SIZE } from "../constants/listings";
import {
  COACH_LISTING_SELECT,
  coachesRowsToListingItems,
  sortCoachListing,
  type CoachListingItem,
  type CoachListingSort,
} from "../coachListing";
import type { CoachSkillLevel } from "../coaches";
import { hydrateCoachVenueEmbeds } from "../hydrateCoachVenues";
import { clampPage, listingPageCount } from "../listingUrlParams";
import { normalizeSearchKey, searchMatchScore } from "../searchFuzzy";
import { createClient } from "../supabase/server";
import type { Coach } from "../coaches";
import type { Venue } from "../venueFilters";

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

  const { data, error } = await supabase.from("coach_outcomes").select("coach_id, outcome").limit(300);
  if (error || !data?.length) return [];

  const seen = new Set<string>();
  const ids: string[] = [];
  for (const row of data) {
    const outcome = row.outcome?.trim() ?? "";
    if (!outcome || searchMatchScore(search, outcome) <= 0) continue;
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

  const { data: venues, error } = await supabase
    .from("venues")
    .select("id")
    .ilike("search_key", `%${key}%`);

  if (error || !venues?.length) return [];

  const venueIds = venues.map((v) => v.id);
  const { data: links, error: linkErr } = await supabase
    .from("coach_venues")
    .select("coach_id")
    .in("venue_id", venueIds);

  if (linkErr || !links?.length) return [];

  return [...new Set(links.map((l) => String((l as { coach_id: string }).coach_id)))];
}

function applyCoachFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: PostgrestFilterBuilder<any, any, any, any, any>,
  input: CoachListingQueryInput,
  locationCoachIds: string[] | null,
  goalCoachIds: string[] | null
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
    if (coachKey) {
      query = query.in("id", locationCoachIds);
    } else {
      query = query.in("id", locationCoachIds);
    }
  }

  if (input.level && input.level !== "all") {
    query = query.eq("level", input.level);
  }

  if (input.travelOnly) {
    query = query.eq("travel_available", true);
  }

  if (input.audienceAdults && input.audienceJuniors) {
    query = query.or(
      "coach_attributes.audience_adults.eq.true,coach_attributes.audience_juniors.eq.true"
    );
  } else if (input.audienceAdults) {
    query = query.eq("coach_attributes.audience_adults", true);
  } else if (input.audienceJuniors) {
    query = query.eq("coach_attributes.audience_juniors", true);
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
  const locationCoachIds = location ? await coachIdsMatchingVenueSearch(location) : null;
  const goalCoachIds = coachGoal ? await coachIdsMatchingOutcomeSearch(coachGoal) : null;

  const countQuery = supabase.from("coaches").select("*", { count: "exact", head: true });
  const countFiltered = applyCoachFilters(countQuery, input, locationCoachIds, goalCoachIds);
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

  let dataQuery = supabase.from("coaches").select(COACH_LISTING_SELECT);
  const dataFiltered = applyCoachFilters(dataQuery, input, locationCoachIds, goalCoachIds);
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

  const rows = (data ?? []) as Coach[];
  const venuesRes = await supabase.from("venues").select("id, city, country, lat, lng").limit(500);
  const venues = (venuesRes.data ?? []) as Venue[];
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
