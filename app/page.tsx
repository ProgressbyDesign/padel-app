import LandingPage from "../components/LandingPage";
import type { HomeStats } from "../components/LandingPage";
import type { BentoVenuePreview } from "../components/home/HomeBentoGrid";
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

  const featuredCoaches = [...coaches].sort((a, b) => recommendedScore(b) - recommendedScore(a)).slice(0, 12);

  const sortedVenues = sortVenuesByBestMatch(venues);
  const featuredVenues = sortedVenues.slice(0, 12);
  const topVenue = sortedVenues[0];
  const enquiryVenueId = topVenue?.id != null ? String(topVenue.id) : null;

  const recommendedCoach = featuredCoaches[0] ?? null;
  let recommendedVenue: BentoVenuePreview | null = null;
  if (topVenue) {
    const subtitle = [topVenue.city, topVenue.country]
      .map((x) => (x != null ? String(x).trim() : ""))
      .filter(Boolean)
      .join(", ");
    recommendedVenue = {
      id: String(topVenue.id),
      name: topVenue.name?.trim() || "Venue",
      subtitle,
      imageUrl: topVenue.main_image?.trim() || topVenue.image_url?.trim() || null,
    };
  }

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
      featuredVenues={featuredVenues}
      whereOptions={whereOptions}
      coachSearchRows={coachSearchRows}
      venueSearchRows={venueSearchRows}
      recommendedCoach={recommendedCoach}
      recommendedVenue={recommendedVenue}
      enquiryVenueId={enquiryVenueId}
      stats={stats}
    />
  );
}
