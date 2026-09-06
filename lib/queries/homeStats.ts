import "server-only";

import { applyPublishedCoachFilter, applyPublishedVenueFilter } from "@/lib/lifecycle/publicationFilters";
import {
  COACH_PUBLIC_PROFILES_TABLE,
  VENUE_PUBLIC_PROFILES_TABLE,
} from "@/lib/publicProfiles";
import { countUniqueDestinations, sumKnownCourts } from "@/lib/home/statsMath";
import { createClient } from "@/lib/supabase/server";

export type HomeStats = {
  coachesListed: number;
  countriesCovered: number;
  locationsAvailable: number;
  enquiriesCompleted: number | null;
};

type VenueStatRow = {
  courts: number | string | null;
  city: string | null;
  country: string | null;
};

/**
 * Homepage / About stats from published public profiles.
 * Courts & academies = sum of venue_public_profiles.courts where courts > 0.
 * There is no separate academies or court-inventory table; venues with a
 * null/0 court count are omitted from that sum.
 */
export async function fetchHomeStats(): Promise<HomeStats> {
  const supabase = await createClient();

  let coachCountQuery = supabase
    .from(COACH_PUBLIC_PROFILES_TABLE)
    .select("id", { count: "exact", head: true });
  coachCountQuery = applyPublishedCoachFilter(coachCountQuery);

  let venueStatsQuery = supabase
    .from(VENUE_PUBLIC_PROFILES_TABLE)
    .select("courts, city, country")
    .limit(3000);
  venueStatsQuery = applyPublishedVenueFilter(venueStatsQuery);

  const [coachCountRes, venueStatsRes] = await Promise.all([
    coachCountQuery,
    venueStatsQuery,
  ]);

  const venueRows = (venueStatsRes.data ?? []) as VenueStatRow[];

  return {
    coachesListed:
      !coachCountRes.error && typeof coachCountRes.count === "number"
        ? coachCountRes.count
        : 0,
    locationsAvailable: venueStatsRes.error ? 0 : sumKnownCourts(venueRows),
    countriesCovered: venueStatsRes.error ? 0 : countUniqueDestinations(venueRows),
    enquiriesCompleted: null,
  };
}
