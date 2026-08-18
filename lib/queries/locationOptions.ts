import { createClient } from "../supabase/server";
import { buildWhereOptions, type Venue, type WhereOption } from "../venueFilters";
import { applyPublishedVenueFilter } from "../lifecycle/publicationFilters";

/** Distinct countries + city pairs for location comboboxes (no full venue load). */
export async function fetchVenueWhereOptions(): Promise<WhereOption[]> {
  const supabase = await createClient();
  let venueQuery = supabase
    .from("venues")
    .select("city, country")
    .not("country", "is", null)
    .limit(2000);
  venueQuery = applyPublishedVenueFilter(venueQuery);
  const { data, error } = await venueQuery;

  if (error || !data?.length) {
    return buildWhereOptions([]);
  }

  const venues = data as Pick<Venue, "city" | "country">[];
  return buildWhereOptions(venues as Venue[]);
}
