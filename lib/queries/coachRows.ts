import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  COACH_LISTING_SELECT,
  coachesRowsToListingItems,
  type CoachListingItem,
} from "../coachListing";
import type { Coach } from "../coaches";
import {
  COACH_VENUES_WITH_VENUE_SELECT,
  type CoachVenueLinkRow,
} from "../coachVenueGeo";
import { hydrateCoachVenueEmbeds } from "../hydrateCoachVenues";
import { createClient } from "../supabase/server";
import type { Venue } from "../venueFilters";

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
  ${COACH_IMAGES_EMBED},
  ${COACH_VENUES_WITH_VENUE_SELECT}
`;

const COACH_LISTING_SELECT_VENUES_ONLY = `
  *,
  ${COACH_IMAGES_EMBED},
  ${COACH_VENUES_WITH_VENUE_SELECT}
`;

async function attachCoachVenueAndOutcomeEmbeds(
  supabase: SupabaseClient,
  rows: Coach[]
): Promise<Coach[]> {
  const ids = rows.map((row) => row.id).filter((id) => id != null && String(id).trim());
  if (ids.length === 0) return rows;

  const [linksRes, outcomesRes, imagesRes] = await Promise.all([
    supabase
      .from("coach_venues")
      .select(
        `
        coach_id,
        is_primary,
        venue_id,
        venues (
          id,
          name,
          city,
          country,
          lat,
          lng
        )
      `
      )
      .in("coach_id", ids)
      .in("status", ["active", "unverified"]),
    supabase.from("coach_outcomes").select("coach_id, outcome").in("coach_id", ids),
    supabase
      .from("coach_images")
      .select("coach_id, image_url, is_primary")
      .in("coach_id", ids),
  ]);

  const venuesByCoach = new Map<string, CoachVenueLinkRow[]>();
  for (const link of linksRes.data ?? []) {
    const coachId = String((link as { coach_id?: string }).coach_id ?? "");
    if (!coachId) continue;
    const entry: CoachVenueLinkRow = {
      is_primary: (link as { is_primary?: boolean }).is_primary,
      venue_id: (link as { venue_id?: string }).venue_id,
      venues: (link as { venues?: CoachVenueLinkRow["venues"] }).venues,
    };
    const list = venuesByCoach.get(coachId) ?? [];
    list.push(entry);
    venuesByCoach.set(coachId, list);
  }

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

  return rows.map((row) => {
    const id = String(row.id);
    return {
      ...row,
      coach_venues: venuesByCoach.get(id) ?? row.coach_venues ?? null,
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
    const res = await supabase.from("coaches").select(select).limit(limit);
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
  const [venuesRes, coachResult] = await Promise.all([
    supabase.from("venues").select("*").limit(500),
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
