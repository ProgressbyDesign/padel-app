import { createClient } from "../supabase/server";
import { buildWhereOptions, type Venue, type WhereOption } from "../venueFilters";

/** Distinct countries + city pairs for location comboboxes (no full venue load). */
export async function fetchVenueWhereOptions(): Promise<WhereOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("venues")
    .select("city, country")
    .not("country", "is", null)
    .limit(2000);

  if (error || !data?.length) {
    return buildWhereOptions([]);
  }

  const venues = data as Pick<Venue, "city" | "country">[];
  return buildWhereOptions(venues as Venue[]);
}
