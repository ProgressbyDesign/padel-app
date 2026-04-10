import { notFound } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import VenueDetailPage from "../../../components/VenueDetailPage";
import { pickSimilarVenues } from "../../../lib/venueDetailHelpers";
import type { Venue } from "../../../lib/venueFilters";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
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

  const { data: venue, error } = await supabase.from("venues").select("*").eq("id", id).maybeSingle();

  if (error || !venue) {
    notFound();
  }

  const typedVenue = venue as Venue;

  const { data: pool } = await supabase.from("venues").select("*").neq("id", id).limit(48);

  const similarVenues = pickSimilarVenues(typedVenue, (pool ?? []) as Venue[], 4);

  return <VenueDetailPage venue={typedVenue} similarVenues={similarVenues} />;
}
