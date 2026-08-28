import { createClient } from "../supabase/server";
import { buildWhereOptions, type Venue, type WhereOption } from "../venueFilters";
import { applyPublishedVenueFilter } from "../lifecycle/publicationFilters";
import { VENUE_PUBLIC_PROFILES_TABLE, asPublicRows } from "../publicProfiles";

/** Distinct countries + city pairs for location comboboxes (no full venue load). */
export async function fetchVenueWhereOptions(): Promise<WhereOption[]> {
  const supabase = await createClient();
  let venueQuery = supabase
    .from(VENUE_PUBLIC_PROFILES_TABLE)
    .select("city, country")
    .not("country", "is", null)
    .limit(2000);
  venueQuery = applyPublishedVenueFilter(venueQuery);
  const { data, error } = await venueQuery;

  if (error || !data?.length) {
    return buildWhereOptions([]);
  }

  const venues = asPublicRows<Pick<Venue, "city" | "country">>(data);
  return buildWhereOptions(venues as Venue[]);
}
