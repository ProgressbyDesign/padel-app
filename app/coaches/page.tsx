import type { Metadata } from "next";
import { Suspense } from "react";
import CoachesListingClient from "../../components/coaches/CoachesListingClient";
import { firstQueryString, parseCoachListingParams } from "../../lib/listingUrlParams";
import { fetchCoachListingPage } from "../../lib/queries/coachListingQuery";

export const metadata: Metadata = {
  title: "Find a coach",
  description: "Discover padel coaches by city, level, audience, and more. Train anywhere, improve faster.",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CoachesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const urlState = parseCoachListingParams(sp);

  const latRaw = firstQueryString(sp.lat);
  const lngRaw = firstQueryString(sp.lng);
  const nearLat = latRaw ? Number(latRaw) : null;
  const nearLng = lngRaw ? Number(lngRaw) : null;

  const listing = await fetchCoachListingPage({
    page: urlState.page,
    location: urlState.location,
    coach: urlState.coach,
    level: urlState.level,
    audienceAdults: urlState.audienceAdults,
    audienceJuniors: urlState.audienceJuniors,
    travelOnly: urlState.travelOnly,
    sort: urlState.sort,
    nearLat: Number.isFinite(nearLat) ? nearLat : null,
    nearLng: Number.isFinite(nearLng) ? nearLng : null,
  });

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-16 text-center text-sm text-primary/60">Loading coaches…</div>
      }
    >
      <CoachesListingClient
        coaches={listing.coaches}
        totalCount={listing.totalCount}
        page={listing.page}
        totalPages={listing.totalPages}
        pageSize={listing.pageSize}
        urlState={urlState}
        nearLat={Number.isFinite(nearLat) ? nearLat : null}
        nearLng={Number.isFinite(nearLng) ? nearLng : null}
      />
    </Suspense>
  );
}
