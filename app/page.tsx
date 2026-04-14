import { supabase } from "../lib/supabase";
import LandingPage from "../components/LandingPage";
import type { Coach } from "../lib/coaches";
import { toCoachSearchRows, toVenueSearchRows } from "../lib/coaches";
import { buildWhereOptions, sortVenuesByBestMatch, type Venue } from "../lib/venueFilters";

export const metadata = {
  title: "Find the best venues abroad",
  description: "Discover curated padel venues, coaching, and high-quality courts worldwide.",
};

export default async function Home() {
  const [venuesRes, coachesRes] = await Promise.all([
    supabase.from("venues").select("*").limit(100),
    supabase.from("coaches").select("id, name, role, description, image_url").limit(200),
  ]);

  const venues = (venuesRes.data ?? []) as Venue[];
  const coachSearchRows =
    coachesRes.error || !coachesRes.data ? [] : toCoachSearchRows(coachesRes.data as Coach[]);
  const venueSearchRows = toVenueSearchRows(venues);
  const featuredVenues = sortVenuesByBestMatch(venues).slice(0, 6);
  const whereOptions = buildWhereOptions(venues);

  return (
    <LandingPage
      featuredVenues={featuredVenues}
      whereOptions={whereOptions}
      coachSearchRows={coachSearchRows}
      venueSearchRows={venueSearchRows}
    />
  );
}
