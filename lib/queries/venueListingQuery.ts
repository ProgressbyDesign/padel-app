import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import { LISTING_PAGE_SIZE } from "../constants/listings";
import { applyPublishedVenueFilter } from "../lifecycle/publicationFilters";
import { clampPage, listingPageCount } from "../listingUrlParams";
import {
  PUBLIC_VENUE_SELECT,
  VENUE_PUBLIC_PROFILES_TABLE,
  asPublicRows,
  type PublicVenueRow,
} from "../publicProfiles";
import { applyVenueLocationFilter, applyVenueNameFilter } from "../venueSearchFilters";
import { createClient } from "../supabase/server";
import type { FilterState, PublicVenue, SortBy, SortDirection } from "../venueFilters";
import { mapPublicVenueRow } from "./mapPublicVenue";
import { hydrateVenueImages } from "./venueImages";

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
  venues: PublicVenue[];
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
    query = applyVenueLocationFilter(query, location);
  }

  const venue = filters.venueQuery.trim();
  if (venue) {
    query = applyVenueNameFilter(query, venue);
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
  const supabase = await createClient();
  const pageSize = input.pageSize ?? LISTING_PAGE_SIZE;

  let countQuery = supabase
    .from(VENUE_PUBLIC_PROFILES_TABLE)
    .select("id", { count: "exact", head: true });
  countQuery = applyPublishedVenueFilter(countQuery);
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

  let venues: PublicVenue[] = [];

  if (useDistanceSort) {
    let idQuery = supabase.from(VENUE_PUBLIC_PROFILES_TABLE).select("id, lat, lng");
    idQuery = applyPublishedVenueFilter(idQuery);
    idQuery = applyVenueFilters(idQuery, input.filters);
    const { data: idRows, error: idErr } = await idQuery;
    if (idErr || !idRows?.length) {
      return { venues: [], totalCount, page, pageSize, totalPages };
    }
    const lat0 = input.nearLat!;
    const lng0 = input.nearLng!;
    const asc = input.sortDirection === "asc";
    const sortedIds = [...asPublicRows<Pick<PublicVenue, "id" | "lat" | "lng">>(idRows)].sort((a, b) => {
      const da = venueDistanceScore(a, lat0, lng0);
      const db = venueDistanceScore(b, lat0, lng0);
      return asc ? da - db : db - da;
    });
    const pageIds = sortedIds.slice(from, to + 1).map((r) => r.id);
    let pageQuery = supabase
      .from(VENUE_PUBLIC_PROFILES_TABLE)
      .select(PUBLIC_VENUE_SELECT)
      .in("id", pageIds);
    pageQuery = applyPublishedVenueFilter(pageQuery);
    const { data: pageRows, error: pageErr } = await pageQuery;
    if (pageErr || !pageRows) {
      return { venues: [], totalCount, page, pageSize, totalPages };
    }
    const mapped = asPublicRows<PublicVenueRow>(pageRows).map(mapPublicVenueRow);
    const byId = new Map(mapped.map((v) => [String(v.id), v]));
    venues = pageIds.map((id) => byId.get(String(id))).filter((v): v is PublicVenue => v != null);
  } else {
    let dataQuery = supabase.from(VENUE_PUBLIC_PROFILES_TABLE).select(PUBLIC_VENUE_SELECT);
    dataQuery = applyPublishedVenueFilter(dataQuery);
    dataQuery = applyVenueFilters(dataQuery, input.filters);
    dataQuery = applyVenueSort(dataQuery, input.sortBy, input.sortDirection);

    const { data, error } = await dataQuery.range(from, to);

    if (error) {
      console.warn("[venues] listing page failed:", error.message);
      return { venues: [], totalCount: 0, page: 1, pageSize, totalPages: 1 };
    }
    venues = asPublicRows<PublicVenueRow>(data).map(mapPublicVenueRow);
  }

  const venuesWithImages = await hydrateVenueImages(supabase, venues);

  return {
    venues: venuesWithImages,
    totalCount,
    page,
    pageSize,
    totalPages,
  };
}

function venueDistanceScore(v: PublicVenue, lat0: number, lng0: number): number {
  const lat = typeof v.lat === "number" ? v.lat : Number(v.lat);
  const lng = typeof v.lng === "number" ? v.lng : Number(v.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Infinity;
  return (lat - lat0) ** 2 + (lng - lng0) ** 2;
}
