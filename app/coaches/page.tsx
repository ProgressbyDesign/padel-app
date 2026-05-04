import type { Metadata } from "next";
import CoachesListingClient from "../../components/coaches/CoachesListingClient";
import { toCoachSearchRows, toVenueSearchRows } from "../../lib/coaches";
import { buildWhereOptions } from "../../lib/venueFilters";
import { loadCoachesExplorerData } from "../../lib/coachListing";

export const metadata: Metadata = {
  title: "Find a coach",
  description: "Discover padel coaches by city, level, audience, and more. Train anywhere, improve faster.",
};

export default async function CoachesPage() {
  const { venues, coaches, coachEntities } = await loadCoachesExplorerData();
  const whereOptions = buildWhereOptions(venues);
  const coachSearchRows =
    coachEntities.length > 0
      ? toCoachSearchRows(coachEntities)
      : coaches.map((c) => ({ id: c.id, name: c.name, role: c.level }));
  const venueSearchRows = toVenueSearchRows(venues);

  return (
    <CoachesListingClient
      coaches={coaches}
      whereOptions={whereOptions}
      coachSearchRows={coachSearchRows}
      venueSearchRows={venueSearchRows}
      loading={false}
    />
  );
}
