import { supabase } from "../lib/supabase";
import LandingPage from "../components/LandingPage";
import { buildWhereOptions, sortVenuesByBestMatch, type Venue } from "../lib/venueFilters";

export const metadata = {
  title: "Find the best venues abroad",
  description: "Discover curated padel venues, coaching, and high-quality courts worldwide.",
};

export default async function Home() {
  const { data } = await supabase.from("venues").select("*").limit(100);
  const venues = (data ?? []) as Venue[];
  const featuredVenues = sortVenuesByBestMatch(venues).slice(0, 6);
  const whereOptions = buildWhereOptions(venues);

  return <LandingPage featuredVenues={featuredVenues} whereOptions={whereOptions} />;
}
