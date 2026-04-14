import { supabase } from "../../lib/supabase";
import VenuesClient from "../../components/VenuesClient";
import type { Coach } from "../../lib/coaches";
import { toCoachSearchRows } from "../../lib/coaches";
import type { FilterState, Venue } from "../../lib/venueFilters";

export const metadata = {
  title: "Explore venues",
  description: "Filter and compare padel venues by location, courts, coaching, and more.",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstQueryString(v: string | string[] | undefined): string {
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v) && v[0]) return String(v[0]).trim();
  return "";
}

export default async function VenuesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const locationRaw = firstQueryString(sp.location);
  const countryRaw = firstQueryString(sp.country);
  const cityRaw = firstQueryString(sp.city);

  const initialFilters: Partial<FilterState> = {};
  if (locationRaw) {
    initialFilters.locationQuery = locationRaw;
  } else if (cityRaw && countryRaw) {
    initialFilters.locationQuery = `${cityRaw}, ${countryRaw}`;
  } else if (countryRaw) {
    initialFilters.locationQuery = countryRaw;
  } else if (cityRaw) {
    initialFilters.locationQuery = cityRaw;
  }

  const [venuesRes, coachesRes] = await Promise.all([
    supabase.from("venues").select("*").limit(100),
    supabase.from("coaches").select("id, name, role, description, image_url").limit(200),
  ]);

  const venues = (venuesRes.data ?? []) as Venue[];
  const coachSearchRows =
    coachesRes.error || !coachesRes.data ? [] : toCoachSearchRows(coachesRes.data as Coach[]);

  return <VenuesClient venues={venues} coachSearchRows={coachSearchRows} initialFilters={initialFilters} />;
}
