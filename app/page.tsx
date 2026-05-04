import LandingPage from "../components/LandingPage";
import type { HomeStats } from "../components/LandingPage";
import { supabase } from "../lib/supabase";
import { toCoachSearchRows, toVenueSearchRows } from "../lib/coaches";
import { buildWhereOptions, sortVenuesByBestMatch } from "../lib/venueFilters";
import { loadCoachesExplorerData, recommendedScore } from "../lib/coachListing";

export const metadata = {
  title: "Find the best venues abroad",
  description: "Discover curated padel venues, coaching, and high-quality courts worldwide.",
};

function buildHomeStats(
  coachCount: number,
  venueCount: number,
  uniqueCountries: number,
  enquiriesCount: number | null
): HomeStats {
  return {
    coachesListed: coachCount,
    countriesCovered: uniqueCountries,
    locationsAvailable: venueCount,
    enquiriesCompleted: enquiriesCount,
  };
}

export default async function Home() {
  const { venues, coaches, coachEntities } = await loadCoachesExplorerData();

  const coachSearchRows =
    coachEntities.length > 0
      ? toCoachSearchRows(coachEntities)
      : coaches.map((c) => ({ id: c.id, name: c.name, role: c.level }));
  const venueSearchRows = toVenueSearchRows(venues);
  const whereOptions = buildWhereOptions(venues);

  const featuredCoaches = [...coaches].sort((a, b) => recommendedScore(b) - recommendedScore(a)).slice(0, 6);

  const sortedVenues = sortVenuesByBestMatch(venues);
  const enquiryVenueId = sortedVenues[0]?.id != null ? String(sortedVenues[0].id) : null;

  const countrySet = new Set<string>();
  for (const v of venues) {
    const c = v.country != null ? String(v.country).trim() : "";
    if (c) countrySet.add(c);
  }
  for (const c of coaches) {
    const x = c.locationCountry?.trim();
    if (x) countrySet.add(x);
  }

  let enquiriesCompleted: number | null = null;
  const enquiryCountRes = await supabase.from("enquiries").select("*", { count: "exact", head: true });
  if (!enquiryCountRes.error && typeof enquiryCountRes.count === "number") {
    enquiriesCompleted = enquiryCountRes.count;
  }

  const stats = buildHomeStats(coaches.length, venues.length, countrySet.size, enquiriesCompleted);

  return (
    <LandingPage
      featuredCoaches={featuredCoaches}
      whereOptions={whereOptions}
      coachSearchRows={coachSearchRows}
      venueSearchRows={venueSearchRows}
      enquiryVenueId={enquiryVenueId}
      stats={stats}
    />
  );
}
