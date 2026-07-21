import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Venue } from "@/lib/venueFilters";
import {
  sortVenueImages,
  type VenueImageRow,
} from "@/lib/venueImages";

export async function hydrateVenueImages<T extends Venue>(
  supabase: SupabaseClient,
  venues: T[]
): Promise<T[]> {
  const venueIds = [
    ...new Set(venues.map((venue) => String(venue.id)).filter(Boolean)),
  ];
  if (venueIds.length === 0) return venues;

  const { data, error } = await supabase
    .from("venue_images")
    .select("id, venue_id, url, is_primary, created_at")
    .in("venue_id", venueIds)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });

  if (error || !data) return venues;

  const byVenue = new Map<string, VenueImageRow[]>();
  for (const row of data as VenueImageRow[]) {
    const rows = byVenue.get(row.venue_id) ?? [];
    rows.push(row);
    byVenue.set(row.venue_id, rows);
  }

  return venues.map((venue) => ({
    ...venue,
    venue_images: sortVenueImages(byVenue.get(String(venue.id)) ?? []),
  }));
}
