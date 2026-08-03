import {
  coachesRowsToListingItems,
  type CoachListingItem,
} from "../coachListing";
import { hydrateCoachVenueEmbeds } from "../hydrateCoachVenues";
import { applyPublishedVenueFilter } from "../lifecycle/publicationFilters";
import { createClient } from "../supabase/server";
import type { Venue } from "../venueFilters";
import { TOP_RATED_MIN_SCORE, TOP_RATED_SECTION_LIMIT } from "../constants/listings";
import { fetchCoachRowsFromSupabase } from "./coachRows";
import { hydrateVenueImages } from "./venueImages";

function sortByRatingThenReviews(a: CoachListingItem, b: CoachListingItem): number {
  if (b.rating !== a.rating) return b.rating - a.rating;
  return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
}

/**
 * Homepage top coaches: rating DESC, review_count DESC, max 10.
 * Prefers rating ≥ 4.9 when available; otherwise best available.
 */
export async function fetchTopRatedCoachesForHome(): Promise<CoachListingItem[]> {
  const supabase = await createClient();
  let venuesQuery = supabase.from("venues").select("id, city, country, lat, lng").limit(500);
  venuesQuery = applyPublishedVenueFilter(venuesQuery);
  const [venuesRes, coachResult] = await Promise.all([
    venuesQuery,
    fetchCoachRowsFromSupabase(200),
  ]);

  const venues = (venuesRes.data ?? []) as Venue[];
  const hydrated = hydrateCoachVenueEmbeds(coachResult.rows, venues);
  const sorted = coachesRowsToListingItems(hydrated).sort(sortByRatingThenReviews);

  if (sorted.length === 0) return [];

  return sorted.slice(0, TOP_RATED_SECTION_LIMIT);
}

/**
 * Top-rated venues for homepage: rating DESC, capped.
 */
export async function fetchTopRatedVenuesForHome(): Promise<Venue[]> {
  const supabase = await createClient();
  let strictQuery = supabase
    .from("venues")
    .select("*")
    .gte("rating", TOP_RATED_MIN_SCORE)
    .order("rating", { ascending: false })
    .limit(TOP_RATED_SECTION_LIMIT);
  strictQuery = applyPublishedVenueFilter(strictQuery);
  const strict = await strictQuery;

  const strictRows =
    !strict.error && strict.data?.length ? (strict.data as Venue[]) : [];

  if (strictRows.length > 0) {
    return hydrateVenueImages(
      supabase,
      strictRows.slice(0, TOP_RATED_SECTION_LIMIT)
    );
  }

  let relaxedQuery = supabase
    .from("venues")
    .select("*")
    .order("rating", { ascending: false })
    .limit(TOP_RATED_SECTION_LIMIT);
  relaxedQuery = applyPublishedVenueFilter(relaxedQuery);
  const relaxed = await relaxedQuery;

  if (relaxed.error || !relaxed.data?.length) return [];

  return hydrateVenueImages(
    supabase,
    (relaxed.data as Venue[]).slice(0, TOP_RATED_SECTION_LIMIT)
  );
}
