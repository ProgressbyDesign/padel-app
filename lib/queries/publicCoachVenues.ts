import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type CoachVenueLinkRow,
  type VenueGeoRow,
} from "@/lib/coachVenueGeo";
import { PUBLIC_COACH_VENUE_STATUSES } from "@/lib/lifecycle/constants";
import {
  VENUE_PUBLIC_PROFILES_TABLE,
  asPublicRows,
  type PublicVenueRow,
} from "@/lib/publicProfiles";
import { createClient } from "@/lib/supabase/server";

/**
 * Load public coach↔venue relationships for listings, PDP, search, and badges.
 * Venue cores come from venue_public_profiles so unpublished/private venue
 * columns never leak. Does not filter coaches out when they have zero venues.
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
    .select("coach_id, is_primary, venue_id, status")
    .in("coach_id", ids)
    .in("status", [...PUBLIC_COACH_VENUE_STATUSES]);

  if (error || !data?.length) return result;

  const venueIds = [
    ...new Set(
      data
        .map((link) => String((link as { venue_id?: string }).venue_id ?? ""))
        .filter(Boolean)
    ),
  ];

  const venuesById = new Map<string, VenueGeoRow>();
  if (venueIds.length > 0) {
    const { data: venues } = await supabase
      .from(VENUE_PUBLIC_PROFILES_TABLE)
      .select("id, name, city, country, lat, lng")
      .in("id", venueIds);
    for (const venue of asPublicRows<PublicVenueRow>(venues)) {
      venuesById.set(String(venue.id), {
        id: venue.id,
        name: venue.name,
        city: venue.city,
        country: venue.country,
        lat: venue.lat,
        lng: venue.lng,
      });
    }
  }

  for (const link of data) {
    const coachId = String((link as { coach_id?: string }).coach_id ?? "");
    const venueId = String((link as { venue_id?: string }).venue_id ?? "");
    const venue = venuesById.get(venueId);
    if (!coachId || !venue) continue;
    const entry: CoachVenueLinkRow = {
      is_primary: (link as { is_primary?: boolean }).is_primary,
      venue_id: venueId,
      venues: venue,
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
