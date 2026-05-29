import LandingPage from "../components/LandingPage";
import type { HomeStats } from "../components/LandingPage";
import type { BentoVenuePreview } from "../components/home/HomeBentoGrid";
import { supabase } from "../lib/supabase";
import { fetchTopRatedCoachesForHome, fetchTopRatedVenuesForHome } from "../lib/queries/topRatedHome";

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
  const [featuredCoaches, featuredVenues, coachCountRes, venueCountRes, countriesRes, enquiryCountRes] =
    await Promise.all([
      fetchTopRatedCoachesForHome(),
      fetchTopRatedVenuesForHome(),
      supabase.from("coaches").select("*", { count: "exact", head: true }),
      supabase.from("venues").select("*", { count: "exact", head: true }),
      supabase.from("venues").select("country").not("country", "is", null).limit(2000),
      supabase.from("enquiries").select("*", { count: "exact", head: true }),
    ]);

  const topVenue = featuredVenues[0] ?? null;
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
  for (const row of countriesRes.data ?? []) {
    const c = row.country != null ? String(row.country).trim() : "";
    if (c) countrySet.add(c);
  }

  const coachCount =
    !coachCountRes.error && typeof coachCountRes.count === "number" ? coachCountRes.count : 0;
  const venueCount =
    !venueCountRes.error && typeof venueCountRes.count === "number" ? venueCountRes.count : 0;
  const enquiriesCompleted =
    !enquiryCountRes.error && typeof enquiryCountRes.count === "number"
      ? enquiryCountRes.count
      : null;

  const stats = buildHomeStats(coachCount, venueCount, countrySet.size, enquiriesCompleted);

  return (
    <LandingPage
      featuredCoaches={featuredCoaches}
      featuredVenues={featuredVenues}
      recommendedCoach={recommendedCoach}
      recommendedVenue={recommendedVenue}
      enquiryVenueId={enquiryVenueId}
      stats={stats}
    />
  );
}
