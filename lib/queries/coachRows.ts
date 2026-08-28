import type { CoachListingItem } from "../coachListing";
import { coachesRowsToListingItems } from "../coachListing";
import { hydrateCoachVenueEmbeds } from "../hydrateCoachVenues";
import {
  applyPublishedCoachFilter,
  applyPublishedVenueFilter,
} from "../lifecycle/publicationFilters";
import {
  COACH_PUBLIC_PROFILES_TABLE,
  PUBLIC_COACH_SELECT,
  VENUE_PUBLIC_PROFILES_TABLE,
  asPublicRows,
  type PublicCoachRow,
} from "../publicProfiles";
import { createClient } from "../supabase/server";
import type { Coach } from "../coaches";
import type { Venue } from "../venueFilters";
import { hydratePublicCoachRows } from "./hydratePublicCoaches";

/**
 * Loads published coach cores from the public projection, then hydrates
 * publication-safe child rows. Used by homepage / explorer surfaces.
 */
export async function fetchCoachRowsFromSupabase(limit = 200): Promise<{
  rows: Coach[];
  error: string | null;
}> {
  const supabase = await createClient();
  let query = supabase.from(COACH_PUBLIC_PROFILES_TABLE).select(PUBLIC_COACH_SELECT).limit(limit);
  query = applyPublishedCoachFilter(query);
  const res = await query;
  if (res.error) {
    return { rows: [], error: res.error.message };
  }
  if (!res.data?.length) {
    return { rows: [], error: null };
  }
  const rows = await hydratePublicCoachRows(supabase, asPublicRows<PublicCoachRow>(res.data));
  return { rows, error: null };
}

/** Server: venues + coach listing + raw coach rows for PLP / SEO routes. */
export async function loadCoachesExplorerData(): Promise<{
  venues: Venue[];
  coaches: CoachListingItem[];
  coachEntities: Coach[];
}> {
  const supabase = await createClient();
  let venuesQuery = supabase
    .from(VENUE_PUBLIC_PROFILES_TABLE)
    .select("id, name, city, country, lat, lng, image_url")
    .limit(500);
  venuesQuery = applyPublishedVenueFilter(venuesQuery);
  const [venuesRes, coachResult] = await Promise.all([
    venuesQuery,
    fetchCoachRowsFromSupabase(200),
  ]);

  const venues = asPublicRows<Venue>(venuesRes.data);
  const coachEntities = hydrateCoachVenueEmbeds(coachResult.rows, venues);
  const coaches = coachesRowsToListingItems(coachEntities);

  if (coachResult.error && coachEntities.length === 0) {
    console.warn("[coaches] Supabase listing fetch failed:", coachResult.error);
  }

  return { venues, coaches, coachEntities };
}
