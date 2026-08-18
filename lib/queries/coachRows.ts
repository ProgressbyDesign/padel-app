import type { SupabaseClient } from "@supabase/supabase-js";
import {
  COACH_LISTING_SELECT,
  coachesRowsToListingItems,
  type CoachListingItem,
} from "../coachListing";
import type { Coach } from "../coaches";
import { hydrateCoachVenueEmbeds } from "../hydrateCoachVenues";
import {
  applyPublishedCoachFilter,
  applyPublishedVenueFilter,
} from "../lifecycle/publicationFilters";
import { createClient } from "../supabase/server";
import type { Venue } from "../venueFilters";
import { attachPublicCoachVenueRelationships } from "./publicCoachVenues";

const COACH_IMAGES_EMBED = `
  coach_images (
    image_url,
    is_primary
  )
`;

const COACH_LISTING_SELECT_OUTCOMES_VENUES = `
  *,
  coach_outcomes (
    outcome
  ),
  ${COACH_IMAGES_EMBED}
`;

const COACH_LISTING_SELECT_VENUES_ONLY = `
  *,
  ${COACH_IMAGES_EMBED}
`;

async function attachCoachVenueAndOutcomeEmbeds(
  supabase: SupabaseClient,
  rows: Coach[]
): Promise<Coach[]> {
  const ids = rows.map((row) => row.id).filter((id) => id != null && String(id).trim());
  if (ids.length === 0) return rows;

  const withVenues = await attachPublicCoachVenueRelationships(rows, supabase);

  const [outcomesRes, imagesRes] = await Promise.all([
    supabase.from("coach_outcomes").select("coach_id, outcome").in("coach_id", ids),
    supabase
      .from("coach_images")
      .select("coach_id, image_url, is_primary")
      .in("coach_id", ids),
  ]);

  const outcomesByCoach = new Map<string, { outcome?: string | null }[]>();
  for (const row of outcomesRes.data ?? []) {
    const coachId = String((row as { coach_id?: string }).coach_id ?? "");
    if (!coachId) continue;
    const list = outcomesByCoach.get(coachId) ?? [];
    list.push({ outcome: (row as { outcome?: string | null }).outcome });
    outcomesByCoach.set(coachId, list);
  }

  const imagesByCoach = new Map<
    string,
    { image_url?: string | null; is_primary?: boolean | null }[]
  >();
  for (const row of imagesRes.data ?? []) {
    const coachId = String((row as { coach_id?: string }).coach_id ?? "");
    if (!coachId) continue;
    const list = imagesByCoach.get(coachId) ?? [];
    list.push({
      image_url: (row as { image_url?: string | null }).image_url,
      is_primary: (row as { is_primary?: boolean | null }).is_primary,
    });
    imagesByCoach.set(coachId, list);
  }

  return withVenues.map((row) => {
    const id = String(row.id);
    return {
      ...row,
      coach_outcomes: outcomesByCoach.get(id) ?? row.coach_outcomes ?? null,
      coach_images: imagesByCoach.get(id) ?? row.coach_images ?? null,
    };
  });
}

/**
 * Loads coach rows with nested embeds; degrades select shape on PostgREST errors
 * so listing and homepage queries do not return empty silently.
 */
export async function fetchCoachRowsFromSupabase(limit = 200): Promise<{
  rows: Coach[];
  error: string | null;
}> {
  const supabase = await createClient();
  const selects = [
    COACH_LISTING_SELECT,
    COACH_LISTING_SELECT_OUTCOMES_VENUES,
    COACH_LISTING_SELECT_VENUES_ONLY,
    "*",
  ];

  let lastError: string | null = null;

  for (const select of selects) {
    let query = supabase.from("coaches").select(select).limit(limit);
    query = applyPublishedCoachFilter(query);
    const res = await query;
    if (res.error) {
      lastError = res.error.message;
      continue;
    }
    if (!res.data?.length) {
      return { rows: [], error: null };
    }

    let rows = res.data as unknown as Coach[];
    if (select === "*") {
      rows = await attachCoachVenueAndOutcomeEmbeds(supabase, rows);
    } else {
      rows = await attachPublicCoachVenueRelationships(rows, supabase);
    }
    return { rows, error: null };
  }

  return { rows: [], error: lastError };
}

/** Server: venues + coach listing + raw coach rows for PLP / SEO routes. */
export async function loadCoachesExplorerData(): Promise<{
  venues: Venue[];
  coaches: CoachListingItem[];
  coachEntities: Coach[];
}> {
  const supabase = await createClient();
  let venuesQuery = supabase.from("venues").select("*").limit(500);
  venuesQuery = applyPublishedVenueFilter(venuesQuery);
  const [venuesRes, coachResult] = await Promise.all([
    venuesQuery,
    fetchCoachRowsFromSupabase(200),
  ]);

  const venues = (venuesRes.data ?? []) as Venue[];
  const coachEntities = hydrateCoachVenueEmbeds(coachResult.rows, venues);
  const coaches = coachesRowsToListingItems(coachEntities);

  if (coachResult.error && coachEntities.length === 0) {
    console.warn("[coaches] Supabase listing fetch failed:", coachResult.error);
  }

  return { venues, coaches, coachEntities };
}
