import LandingPage from "../components/LandingPage";
import type { BentoVenuePreview } from "../components/home/HomeBentoGrid";
import {
  COACH_APPLICATION_PATH,
  VENUE_APPLICATION_PATH,
  partnerSignupHref,
} from "../lib/join/nav";
import { fetchPadelCountries } from "../lib/queries/padelCountries";
import { fetchHomeStats } from "../lib/queries/homeStats";
import { fetchTopRatedCoachesForHome, fetchTopRatedVenuesForHome } from "../lib/queries/topRatedHome";
import { getVenueMainImageUrl } from "../lib/venueDetailHelpers";
import { loadOptionalAccountNavContext } from "../lib/workspace/resolve";

export const metadata = {
  title: "Find the best venues abroad",
  description: "Discover curated padel venues, coaching, and high-quality courts worldwide.",
};

export default async function Home() {
  const [
    featuredCoaches,
    featuredVenues,
    destinationCountries,
    stats,
    accountNav,
  ] = await Promise.all([
    fetchTopRatedCoachesForHome(),
    fetchTopRatedVenuesForHome(),
    fetchPadelCountries(),
    fetchHomeStats(),
    loadOptionalAccountNavContext(),
  ]);

  const topVenue = featuredVenues[0] ?? null;
  const enquiryVenueId = topVenue?.id != null ? String(topVenue.id) : null;
  const recommendedCoach = featuredCoaches[0] ?? null;
  const signedIn = Boolean(accountNav);

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
      city: topVenue.city ?? null,
      country: topVenue.country ?? null,
      imageUrl: getVenueMainImageUrl(topVenue),
      rating: topVenue.rating ?? null,
      courts: topVenue.courts ?? null,
      coachingAvailable: topVenue.coaching_available ?? null,
      courtType: topVenue.court_type ?? null,
    };
  }

  return (
    <LandingPage
      featuredCoaches={featuredCoaches}
      featuredVenues={featuredVenues}
      recommendedCoach={recommendedCoach}
      recommendedVenue={recommendedVenue}
      enquiryVenueId={enquiryVenueId}
      stats={stats}
      destinationCountries={destinationCountries}
      coachRegisterHref={partnerSignupHref(COACH_APPLICATION_PATH, signedIn)}
      venueRegisterHref={partnerSignupHref(VENUE_APPLICATION_PATH, signedIn)}
    />
  );
}
