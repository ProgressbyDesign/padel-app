import { notFound } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import VenueDetailPage from "../../../components/VenueDetailPage";
import { pickSimilarVenues } from "../../../lib/venueDetailHelpers";
import type { Coach } from "../../../lib/coaches";
import { resolveCoachImageUrl } from "../../../lib/coachImageResolve";
import type { Venue } from "../../../lib/venueFilters";
import { hydrateVenueImages } from "../../../lib/queries/venueImages";
import { loadVenueSocials } from "../../../lib/queries/venueSocials";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("venues").select("name, city, country").eq("id", id).maybeSingle();

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

  const { data: venue, error } = await supabase.from("venues").select("*").eq("id", id).maybeSingle();

  if (error || !venue) {
    notFound();
  }

  const venueRow = venue as Venue;

  const [{ data: pool }, { data: coachLinks }] = await Promise.all([
    supabase.from("venues").select("*").neq("id", id).limit(48),
    supabase.from("coach_venues").select("coach_id").eq("venue_id", id),
  ]);

  const [hydratedVenues, venueSocials] = await Promise.all([
    hydrateVenueImages(supabase, [
      venueRow,
      ...((pool ?? []) as Venue[]),
    ]),
    loadVenueSocials(supabase, id),
  ]);
  const [hydratedVenue, ...hydratedPool] = hydratedVenues;
  const typedVenue: Venue = {
    ...hydratedVenue,
    venue_socials: venueSocials ?? [],
  };
  const similarVenues = pickSimilarVenues(typedVenue, hydratedPool, 4);

  const coachIds = Array.from(
    new Set(
      (coachLinks ?? [])
        .map((row: { coach_id?: string }) => row.coach_id)
        .filter((cid): cid is string => Boolean(cid))
    )
  );

  let coaches: Coach[] = [];
  if (coachIds.length > 0) {
    const { data: coachRows } = await supabase
      .from("coaches")
      .select(
        `
        id,
        name,
        role,
        description,
        image_url,
        coach_images ( image_url, is_primary )
      `
      )
      .in("id", coachIds);
    const byId = new Map(
      (coachRows as Coach[] | null)?.map((c) => {
        const resolved = resolveCoachImageUrl(c.coach_images, c.image_url);
        return [
          String(c.id),
          { ...c, image_url: resolved ?? c.image_url },
        ] as const;
      }) ?? []
    );
    coaches = coachIds.map((cid) => byId.get(cid)).filter((c): c is Coach => Boolean(c));
  }

  return <VenueDetailPage venue={typedVenue} similarVenues={similarVenues} coaches={coaches} />;
}
