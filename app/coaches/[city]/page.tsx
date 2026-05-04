import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import CoachesListingClient from "../../../components/coaches/CoachesListingClient";
import { toCoachSearchRows, toVenueSearchRows } from "../../../lib/coaches";
import {
  displayCityFromSlug,
  getCoachListingCitySlugs,
  loadCoachesExplorerData,
} from "../../../lib/coachListing";
import { buildWhereOptions } from "../../../lib/venueFilters";

type PageProps = {
  params: Promise<{ city: string }>;
};

export async function generateStaticParams() {
  const { coaches } = await loadCoachesExplorerData();
  return getCoachListingCitySlugs(coaches).map((city) => ({ city }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city } = await params;
  const slug = decodeURIComponent(city).toLowerCase();
  const label = displayCityFromSlug(slug);
  return {
    title: `Padel coaches in ${label}`,
    description: `Find padel coaches in ${label}. Filter by level, audience, travel, and more.`,
  };
}

export default async function CoachesCityPage({ params }: PageProps) {
  const { city } = await params;
  const slug = decodeURIComponent(city).toLowerCase().trim();

  const { venues, coaches, coachEntities } = await loadCoachesExplorerData();
  const citySlugs = new Set(getCoachListingCitySlugs(coaches));

  if (!slug || !citySlugs.has(slug)) {
    notFound();
  }

  const whereOptions = buildWhereOptions(venues);
  const coachSearchRows =
    coachEntities.length > 0
      ? toCoachSearchRows(coachEntities)
      : coaches.map((c) => ({ id: c.id, name: c.name, role: c.level }));
  const venueSearchRows = toVenueSearchRows(venues);

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-16 text-center text-sm text-primary/60">Loading coaches…</div>
      }
    >
      <CoachesListingClient
        coaches={coaches}
        whereOptions={whereOptions}
        coachSearchRows={coachSearchRows}
        venueSearchRows={venueSearchRows}
        initialCitySlug={slug}
        loading={false}
      />
    </Suspense>
  );
}
