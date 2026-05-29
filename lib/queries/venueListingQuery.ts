import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import { LISTING_PAGE_SIZE } from "../constants/listings";
import { clampPage, listingPageCount } from "../listingUrlParams";
import { normalizeSearchKey } from "../searchFuzzy";
import { supabase } from "../supabase";
import type { FilterState, SortBy, SortDirection, Venue } from "../venueFilters";

export type VenueListingQueryInput = {
  page: number;
  pageSize?: number;
  filters: FilterState;
  sortBy: SortBy;
  sortDirection: SortDirection;
  /** Optional user coords for distance sort */
  nearLat?: number | null;
  nearLng?: number | null;
};

export type VenueListingQueryResult = {
  venues: Venue[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function applyVenueFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: PostgrestFilterBuilder<any, any, any, any, any>,
  filters: FilterState
) {
  const location = filters.locationQuery.trim();
  if (location) {
    const key = normalizeSearchKey(location);
    if (key) {
      query = query.ilike("search_key", `%${key}%`);
    }
  }

  const venue = filters.venueQuery.trim();
  if (venue) {
    const vKey = normalizeSearchKey(venue);
    if (vKey) {
      query = query.ilike("search_key", `%${vKey}%`);
    }
  }

  if (filters.environment === "indoor") {
    query = query.ilike("court_type", "%indoor%");
  } else if (filters.environment === "outdoor") {
    query = query.ilike("court_type", "%outdoor%");
  }

  if (filters.minCourts > 0) {
    query = query.gte("courts", filters.minCourts);
  }

  return query;
}

function applyVenueSort(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: PostgrestFilterBuilder<any, any, any, any, any>,
  sortBy: SortBy,
  sortDirection: SortDirection
) {
  const asc = sortDirection === "asc";

  if (sortBy === "rating") {
    return query.order("rating", { ascending: asc, nullsFirst: false }).order("name", { ascending: true });
  }
  if (sortBy === "courts") {
    return query.order("courts", { ascending: asc, nullsFirst: false }).order("name", { ascending: true });
  }
  if (sortBy === "distance") {
    return query.order("rating", { ascending: false, nullsFirst: false }).order("name", { ascending: true });
  }
  return query
    .order("courts", { ascending: false, nullsFirst: false })
    .order("coaching_available", { ascending: false })
    .order("rating", { ascending: false, nullsFirst: false })
    .order("name", { ascending: true });
}

/** Paginated venue listing — filters and search run in Supabase. */
export async function fetchVenueListingPage(
  input: VenueListingQueryInput
): Promise<VenueListingQueryResult> {
  const pageSize = input.pageSize ?? LISTING_PAGE_SIZE;

  let countQuery = supabase.from("venues").select("*", { count: "exact", head: true });
  countQuery = applyVenueFilters(countQuery, input.filters);
  const countRes = await countQuery;
  const totalCount =
    !countRes.error && typeof countRes.count === "number" ? countRes.count : 0;
  const totalPages = listingPageCount(totalCount, pageSize);
  const page = clampPage(input.page, totalPages);

  if (totalCount === 0) {
    return { venues: [], totalCount: 0, page: 1, pageSize, totalPages: 1 };
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const useDistanceSort =
    input.sortBy === "distance" &&
    input.nearLat != null &&
    input.nearLng != null &&
    Number.isFinite(input.nearLat) &&
    Number.isFinite(input.nearLng);

  let venues: Venue[] = [];

  if (useDistanceSort) {
    let idQuery = supabase.from("venues").select("id, lat, lng");
    idQuery = applyVenueFilters(idQuery, input.filters);
    const { data: idRows, error: idErr } = await idQuery;
    if (idErr || !idRows?.length) {
      return { venues: [], totalCount, page, pageSize, totalPages };
    }
    const lat0 = input.nearLat!;
    const lng0 = input.nearLng!;
    const asc = input.sortDirection === "asc";
    const sortedIds = [...(idRows as Pick<Venue, "id" | "lat" | "lng">[])].sort((a, b) => {
      const da = venueDistanceScore(a, lat0, lng0);
      const db = venueDistanceScore(b, lat0, lng0);
      return asc ? da - db : db - da;
    });
    const pageIds = sortedIds.slice(from, to + 1).map((r) => r.id);
    const { data: pageRows, error: pageErr } = await supabase
      .from("venues")
      .select("*")
      .in("id", pageIds);
    if (pageErr || !pageRows) {
      return { venues: [], totalCount, page, pageSize, totalPages };
    }
    const byId = new Map(pageRows.map((v) => [String((v as Venue).id), v as Venue]));
    venues = pageIds.map((id) => byId.get(String(id))).filter((v): v is Venue => v != null);
  } else {
    let dataQuery = supabase.from("venues").select("*");
    dataQuery = applyVenueFilters(dataQuery, input.filters);
    dataQuery = applyVenueSort(dataQuery, input.sortBy, input.sortDirection);

    const { data, error } = await dataQuery.range(from, to);

    if (error) {
      console.warn("[venues] listing page failed:", error.message);
      return { venues: [], totalCount: 0, page: 1, pageSize, totalPages: 1 };
    }
    venues = (data ?? []) as Venue[];
  }

  return {
    venues,
    totalCount,
    page,
    pageSize,
    totalPages,
  };
}

function venueDistanceScore(v: Venue, lat0: number, lng0: number): number {
  const lat = typeof v.lat === "number" ? v.lat : Number(v.lat);
  const lng = typeof v.lng === "number" ? v.lng : Number(v.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Infinity;
  return (lat - lat0) ** 2 + (lng - lng0) ** 2;
}
