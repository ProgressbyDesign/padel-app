import { notFound } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import CoachProfilePage from "../../../components/CoachProfilePage";
import { fetchCoachPdpById } from "../../../lib/fetchCoachPdp";
import type { Venue } from "../../../lib/venueFilters";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const { data } = await supabase.from("coaches").select("name, role").eq("id", id).maybeSingle();

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

  const coach = await fetchCoachPdpById(id);
  if (!coach) {
    notFound();
  }

  const { data: links } = await supabase.from("coach_venues").select("venue_id").eq("coach_id", id);

  const venueIds = Array.from(
    new Set((links ?? []).map((row: { venue_id?: string }) => row.venue_id).filter((vid): vid is string => Boolean(vid)))
  );

  let venues: Venue[] = [];
  if (venueIds.length > 0) {
    const { data: venueRows } = await supabase.from("venues").select("*").in("id", venueIds);
    const byId = new Map((venueRows as Venue[] | null)?.map((v) => [String(v.id), v]) ?? []);
    venues = venueIds.map((vid) => byId.get(vid)).filter((v): v is Venue => Boolean(v));
  }

  return <CoachProfilePage coach={coach} venues={venues} />;
}
