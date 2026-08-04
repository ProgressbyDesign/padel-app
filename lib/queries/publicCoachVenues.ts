import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type CoachVenueLinkRow,
  type VenueGeoRow,
} from "@/lib/coachVenueGeo";
import { PUBLIC_COACH_VENUE_STATUSES, PUBLISHED_STATUS } from "@/lib/lifecycle/constants";
import { createClient } from "@/lib/supabase/server";

const PUBLIC_VENUE_GEO_SELECT = `
  coach_id,
  is_primary,
  venue_id,
  status,
  venues!inner (
    id,
    name,
    city,
    country,
    lat,
    lng,
    publication_status
  )
`;

/**
 * Load public coach↔venue relationships for listings, PDP, search, and badges.
 * Requires active relationship + published venue. Does not filter coaches out
 * when they have zero matching venues.
 */
export async function loadPublicCoachVenueRelationships(
  coachIds: string[],
  client?: SupabaseClient
): Promise<Map<string, CoachVenueLinkRow[]>> {
  const result = new Map<string, CoachVenueLinkRow[]>();
  const ids = coachIds.map((id) => String(id)).filter(Boolean);
  if (ids.length === 0) return result;

  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("coach_venues")
    .select(PUBLIC_VENUE_GEO_SELECT)
    .in("coach_id", ids)
    .in("status", [...PUBLIC_COACH_VENUE_STATUSES])
    .eq("venues.publication_status", PUBLISHED_STATUS);

  if (error || !data?.length) return result;

  for (const link of data) {
    const coachId = String((link as { coach_id?: string }).coach_id ?? "");
    if (!coachId) continue;
    const entry: CoachVenueLinkRow = {
      is_primary: (link as { is_primary?: boolean }).is_primary,
      venue_id: (link as { venue_id?: string }).venue_id,
      venues: (link as { venues?: VenueGeoRow | VenueGeoRow[] | null }).venues,
    };
    const list = result.get(coachId) ?? [];
    list.push(entry);
    result.set(coachId, list);
  }

  return result;
}

export async function attachPublicCoachVenueRelationships<
  T extends { id?: string | number | null; coach_venues?: CoachVenueLinkRow[] | null },
>(rows: T[], client?: SupabaseClient): Promise<T[]> {
  const ids = rows
    .map((row) => (row.id != null ? String(row.id) : ""))
    .filter(Boolean);
  const byCoach = await loadPublicCoachVenueRelationships(ids, client);
  return rows.map((row) => {
    const id = row.id != null ? String(row.id) : "";
    return {
      ...row,
      coach_venues: byCoach.get(id) ?? [],
    };
  });
}
