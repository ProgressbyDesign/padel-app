import "server-only";

import type { MembershipRole } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import type { VenueImageRow } from "@/lib/venueImages";
import { loadVenueSocials } from "@/lib/queries/venueSocials";
import {
  isValidVenueId,
  loadManagedVenueShell,
} from "@/lib/queries/managedVenueShell";
import type { VenueSocialRow } from "@/lib/venueSocials";

export { isValidVenueId };

export type ManagedVenueDetail = {
  id: string;
  name: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  image_url: string | null;
  courts: number | null;
  court_type: string | null;
  coaching_available: boolean | null;
  price: string | null;
  coaching_description: string | null;
  venue_type: string | null;
  phone: string | null;
  opening_hours: string | null;
  opening_hours_structured: unknown;
  address: string | null;
  rating: number | null;
  review_count: number | null;
  google_place_id: string | null;
  lat: number | null;
  lng: number | null;
  is_approved: boolean | null;
  data_quality_status: string | null;
};

export type ManagedVenueOverview = {
  venue: Pick<
    ManagedVenueDetail,
    | "id"
    | "name"
    | "city"
    | "country"
    | "courts"
    | "court_type"
    | "coaching_available"
    | "coaching_description"
    | "opening_hours"
    | "opening_hours_structured"
    | "address"
    | "rating"
    | "review_count"
    | "google_place_id"
    | "is_approved"
    | "data_quality_status"
    | "website"
    | "phone"
    | "venue_type"
  >;
  membershipRole: MembershipRole;
  imageCount: number;
  socialCount: number;
  activeCoachCount: number;
  hasCoachAvailability: boolean;
};

export type ManagedVenueDetailsResult = {
  venue: ManagedVenueDetail;
  membershipRole: MembershipRole;
};

async function assertManagedVenueAccess(venueId: string) {
  const shell = await loadManagedVenueShell(venueId);
  if (!shell) return null;
  return shell;
}

export async function loadManagedVenueDetails(
  venueId: string
): Promise<ManagedVenueDetailsResult | null> {
  const shell = await assertManagedVenueAccess(venueId);
  if (!shell) return null;

  const supabase = await createClient();
  const { data: venue, error: venueError } = await supabase
    .from("venues")
    .select(
      `
      id,
      name,
      city,
      country,
      website,
      image_url,
      courts,
      court_type,
      coaching_available,
      price,
      coaching_description,
      venue_type,
      phone,
      opening_hours,
      opening_hours_structured,
      address,
      rating,
      review_count,
      google_place_id,
      lat,
      lng,
      is_approved,
      data_quality_status
    `
    )
    .eq("id", venueId)
    .maybeSingle();

  if (venueError || !venue) return null;

  return {
    venue: venue as ManagedVenueDetail,
    membershipRole: shell.membershipRole,
  };
}

export async function loadManagedVenueOverview(
  venueId: string
): Promise<ManagedVenueOverview | null> {
  const shell = await assertManagedVenueAccess(venueId);
  if (!shell) return null;

  const supabase = await createClient();

  const [
    { data: venue, error: venueError },
    images,
    socials,
    coachesResult,
  ] = await Promise.all([
    supabase
      .from("venues")
      .select(
        `
          id,
          name,
          city,
          country,
          website,
          courts,
          court_type,
          coaching_available,
          coaching_description,
          venue_type,
          phone,
          opening_hours,
          opening_hours_structured,
          address,
          rating,
          review_count,
          google_place_id,
          is_approved,
          data_quality_status
        `
      )
      .eq("id", venueId)
      .maybeSingle(),
    loadManagedVenueImages(venueId),
    loadManagedVenueSocialRows(venueId),
    supabase
      .from("coach_venues")
      .select("id")
      .eq("venue_id", venueId)
      .eq("status", "active"),
  ]);

  if (venueError || !venue || !images || !socials) return null;

  const relationshipIds = (coachesResult.data ?? []).map((row) => String(row.id));
  let hasCoachAvailability = false;
  if (relationshipIds.length > 0) {
    const { data: settings } = await supabase
      .from("coach_venue_availability_settings")
      .select("id")
      .in("coach_venue_id", relationshipIds)
      .eq("is_public", true)
      .limit(1);
    hasCoachAvailability = Boolean(settings?.length);
  }

  return {
    venue: venue as ManagedVenueOverview["venue"],
    membershipRole: shell.membershipRole,
    imageCount: images.length,
    socialCount: socials.length,
    activeCoachCount: relationshipIds.length,
    hasCoachAvailability,
  };
}

export async function loadManagedVenueImages(
  venueId: string
): Promise<VenueImageRow[] | null> {
  const shell = await assertManagedVenueAccess(venueId);
  if (!shell) return null;

  const supabase = await createClient();
  const { data: images, error: imagesError } = await supabase
    .from("venue_images")
    .select("id, venue_id, url, is_primary, created_at")
    .eq("venue_id", venueId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });

  if (imagesError) return null;
  return (images ?? []) as VenueImageRow[];
}

export async function loadManagedVenueSocialRows(
  venueId: string
): Promise<VenueSocialRow[] | null> {
  const shell = await assertManagedVenueAccess(venueId);
  if (!shell) return null;

  const supabase = await createClient();
  return loadVenueSocials(supabase, venueId);
}
