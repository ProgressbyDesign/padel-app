import { notFound } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import VenueDetailPage from "../../../components/VenueDetailPage";
import { pickSimilarVenues } from "../../../lib/venueDetailHelpers";
import type { PublicCoachCard } from "../../../lib/coaches";
import { resolveCoachImageUrl } from "../../../lib/coachImageResolve";
import { PUBLIC_COACH_VENUE_STATUSES, PUBLISHED_STATUS } from "../../../lib/lifecycle/constants";
import {
  applyPublishedCoachFilter,
  applyPublishedVenueFilter,
} from "../../../lib/lifecycle/publicationFilters";
import {
  COACH_PUBLIC_PROFILES_TABLE,
  PUBLIC_VENUE_SELECT,
  VENUE_PUBLIC_PROFILES_TABLE,
  asPublicRow,
  asPublicRows,
  type PublicVenueRow,
} from "../../../lib/publicProfiles";
import type { PublicVenue } from "../../../lib/venueFilters";
import { hydrateVenueImages } from "../../../lib/queries/venueImages";
import { loadPublicVenueCoachAvailability } from "../../../lib/queries/coachAvailability";
import { mapPublicVenueRow } from "../../../lib/queries/mapPublicVenue";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  let metaQuery = supabase
    .from(VENUE_PUBLIC_PROFILES_TABLE)
    .select("name, city, country")
    .eq("id", id);
  metaQuery = applyPublishedVenueFilter(metaQuery);
  const { data } = await metaQuery.maybeSingle();

  if (!data?.name) {
    return { title: "Venue | Padel" };
  }

  const place = [data.city, data.country].filter(Boolean).join(", ");
  return {
    title: `${data.name}${place ? ` — ${place}` : ""} | Padel`,
    description: place ? `Padel venue in ${place}.` : `Padel venue: ${data.name}.`,
  };
}

export default async function VenuePdpPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  let venueQuery = supabase
    .from(VENUE_PUBLIC_PROFILES_TABLE)
    .select(PUBLIC_VENUE_SELECT)
    .eq("id", id);
  venueQuery = applyPublishedVenueFilter(venueQuery);
  const { data: venue, error } = await venueQuery.maybeSingle();

  if (error || !venue) {
    notFound();
  }
  const typedCore = asPublicRow<PublicVenueRow>(venue);
  if (!typedCore || typedCore.publication_status !== PUBLISHED_STATUS) {
    notFound();
  }

  const venueRow = mapPublicVenueRow(typedCore);

  let similarPoolQuery = supabase
    .from(VENUE_PUBLIC_PROFILES_TABLE)
    .select(PUBLIC_VENUE_SELECT)
    .neq("id", id)
    .limit(48);
  similarPoolQuery = applyPublishedVenueFilter(similarPoolQuery);

  const [{ data: pool }, { data: coachLinks }] = await Promise.all([
    similarPoolQuery,
    supabase
      .from("coach_venues")
      .select("coach_id, status, is_primary")
      .eq("venue_id", id)
      .in("status", [...PUBLIC_COACH_VENUE_STATUSES])
      .order("is_primary", { ascending: false }),
  ]);

  const hydratedVenues = await hydrateVenueImages(supabase, [
    venueRow,
    ...asPublicRows<PublicVenueRow>(pool).map(mapPublicVenueRow),
  ]);
  const [hydratedVenue, ...hydratedPool] = hydratedVenues;
  const typedVenue: PublicVenue = hydratedVenue;
  const similarVenues = pickSimilarVenues(typedVenue, hydratedPool, 4);

  const coachIds = Array.from(
    new Set(
      (coachLinks ?? [])
        .map((row: { coach_id?: string }) => row.coach_id)
        .filter((cid): cid is string => Boolean(cid))
    )
  );

  let coaches: PublicCoachCard[] = [];
  if (coachIds.length > 0) {
    let coachQuery = supabase
      .from(COACH_PUBLIC_PROFILES_TABLE)
      .select("id, name, role, description, image_url")
      .in("id", coachIds);
    coachQuery = applyPublishedCoachFilter(coachQuery);
    const { data: coachRows } = await coachQuery;
    const { data: coachImages } = await supabase
      .from("coach_images")
      .select("coach_id, image_url, is_primary")
      .in("coach_id", coachIds);
    const imagesByCoach = new Map<
      string,
      { image_url?: string | null; is_primary?: boolean | null }[]
    >();
    for (const row of coachImages ?? []) {
      const coachId = String((row as { coach_id?: string }).coach_id ?? "");
      if (!coachId) continue;
      const list = imagesByCoach.get(coachId) ?? [];
      list.push({
        image_url: (row as { image_url?: string | null }).image_url,
        is_primary: (row as { is_primary?: boolean | null }).is_primary,
      });
      imagesByCoach.set(coachId, list);
    }
    const byId = new Map(
      asPublicRows<PublicCoachCard>(coachRows).map((c) => {
        const resolved = resolveCoachImageUrl(imagesByCoach.get(String(c.id)), c.image_url);
        return [
          String(c.id),
          { ...c, image_url: resolved ?? c.image_url },
        ] as const;
      })
    );
    coaches = coachIds.map((cid) => byId.get(cid)).filter((c): c is PublicCoachCard => Boolean(c));
  }

  const availabilityCards = await loadPublicVenueCoachAvailability(id, 14);

  return (
    <VenueDetailPage
      venue={typedVenue}
      similarVenues={similarVenues}
      coaches={coaches}
      availabilityCards={availabilityCards}
    />
  );
}
