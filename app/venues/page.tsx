import { supabase } from "../../lib/supabase";
import VenuesClient from "../../components/VenuesClient";
import { parseVenueListingParams, firstQueryString } from "../../lib/listingUrlParams";
import { fetchVenueListingPage } from "../../lib/queries/venueListingQuery";

export const metadata = {
  title: "Explore venues",
  description: "Filter and compare padel venues by location, playing conditions, and court count.",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function VenuesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const urlState = parseVenueListingParams(sp);

  const latRaw = firstQueryString(sp.lat);
  const lngRaw = firstQueryString(sp.lng);
  const nearLat = latRaw ? Number(latRaw) : null;
  const nearLng = lngRaw ? Number(lngRaw) : null;

  const listing = await fetchVenueListingPage({
      page: urlState.page,
      filters: urlState.filters,
      sortBy: urlState.sortBy,
      sortDirection: urlState.sortDirection,
      nearLat: Number.isFinite(nearLat) ? nearLat : null,
      nearLng: Number.isFinite(nearLng) ? nearLng : null,
    });

  return (
    <VenuesClient
      venues={listing.venues}
      totalCount={listing.totalCount}
      page={listing.page}
      totalPages={listing.totalPages}
      pageSize={listing.pageSize}
      urlState={urlState}
      nearLat={Number.isFinite(nearLat) ? nearLat : null}
      nearLng={Number.isFinite(nearLng) ? nearLng : null}
    />
  );
}
