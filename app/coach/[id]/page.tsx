import { notFound } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import CoachProfilePage from "../../../components/CoachProfilePage";
import { fetchCoachPdpById } from "../../../lib/fetchCoachPdp";
import { PUBLIC_COACH_VENUE_STATUSES } from "../../../lib/lifecycle/constants";
import { applyPublishedVenueFilter } from "../../../lib/lifecycle/publicationFilters";
import {
  COACH_PUBLIC_PROFILES_TABLE,
  PUBLIC_VENUE_SELECT,
  VENUE_PUBLIC_PROFILES_TABLE,
  asPublicRows,
  type PublicVenueRow,
} from "../../../lib/publicProfiles";
import type { PublicVenue } from "../../../lib/venueFilters";
import { loadPublicCoachAvailability } from "../../../lib/queries/coachAvailability";
import { mapPublicVenueRow } from "../../../lib/queries/mapPublicVenue";
import { hydrateVenueImages } from "../../../lib/queries/venueImages";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from(COACH_PUBLIC_PROFILES_TABLE)
    .select("name, role")
    .eq("id", id)
    .maybeSingle();

  if (!data?.name) {
    return { title: "Coach | Padel" };
  }

  const role = data.role?.trim();
  return {
    title: `${data.name.trim()}${role ? ` — ${role}` : ""} | Padel`,
    description: role ? `Coach: ${data.name.trim()} (${role}).` : `Coach profile: ${data.name.trim()}.`,
  };
}

export default async function CoachPdpPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const coach = await fetchCoachPdpById(id);
  if (!coach) {
    notFound();
  }

  const [{ data: links }, availabilityGroups] = await Promise.all([
    supabase
      .from("coach_venues")
      .select("venue_id, is_primary, status")
      .eq("coach_id", id)
      .in("status", [...PUBLIC_COACH_VENUE_STATUSES])
      .order("is_primary", { ascending: false }),
    loadPublicCoachAvailability(id, 14),
  ]);

  const venueIds = Array.from(
    new Set(
      (links ?? [])
        .map((row: { venue_id?: string }) => row.venue_id)
        .filter((vid): vid is string => Boolean(vid))
    )
  );

  let venues: PublicVenue[] = [];
  if (venueIds.length > 0) {
    let venueQuery = supabase
      .from(VENUE_PUBLIC_PROFILES_TABLE)
      .select(PUBLIC_VENUE_SELECT)
      .in("id", venueIds);
    venueQuery = applyPublishedVenueFilter(venueQuery);
    const { data: venueRows } = await venueQuery;
    const mapped = asPublicRows<PublicVenueRow>(venueRows).map(mapPublicVenueRow);
    const hydrated = await hydrateVenueImages(supabase, mapped);
    const byId = new Map(hydrated.map((v) => [String(v.id), v]));
    venues = venueIds.map((vid) => byId.get(vid)).filter((v): v is PublicVenue => Boolean(v));
  }

  return (
    <CoachProfilePage
      coach={coach}
      venues={venues}
      availabilityGroups={availabilityGroups}
    />
  );
}
