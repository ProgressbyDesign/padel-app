import "server-only";

import { requireAdminPermission } from "@/lib/auth/adminSession";
import {
  buildCoachCompletion,
  buildVenueCompletion,
} from "@/lib/coachProfileCompletion";
import { getStructuredOpeningHours } from "@/lib/openingHours";
import { createClient } from "@/lib/supabase/server";

export type OpsCoachOverview = {
  coach: {
    id: string;
    name: string | null;
    role: string | null;
    description: string | null;
    experience_years: number | null;
    phone: string | null;
    email: string | null;
    price_from: number | null;
    image_url: string | null;
    is_approved: boolean | null;
    level: string | null;
  };
  primaryLocation: string | null;
  hasPrimaryLocation: boolean;
  imageCount: number;
  socialCount: number;
  venueCount: number;
  achievementCount: number;
  audienceAdults: boolean;
  audienceJuniors: boolean;
  playerLevels: string[];
  outcomes: string[];
  availabilityLive: boolean;
  pendingBookingCount: number;
  applicationId: string | null;
  completion: ReturnType<typeof buildCoachCompletion>;
};

export type OpsVenueOverview = {
  venue: {
    id: string;
    name: string | null;
    city: string | null;
    country: string | null;
    address: string | null;
    website: string | null;
    phone: string | null;
    courts: number | null;
    court_type: string | null;
    venue_type: string | null;
    coaching_description: string | null;
    opening_hours_structured: unknown;
    is_approved: boolean | null;
  };
  imageCount: number;
  socialCount: number;
  activeCoachCount: number;
  hasCoachAvailability: boolean;
  applicationId: string | null;
  completion: ReturnType<typeof buildVenueCompletion>;
};

export async function loadOpsCoachOverview(
  coachId: string
): Promise<OpsCoachOverview | null> {
  await requireAdminPermission("profiles.read");
  const supabase = await createClient();

  const [
    coachResult,
    imagesResult,
    socialsResult,
    venuesResult,
    attributesResult,
    outcomesResult,
    locationsResult,
    achievementsResult,
    bookingsResult,
    applicationResult,
  ] = await Promise.all([
    supabase
      .from("coaches")
      .select(
        "id, name, role, description, experience_years, phone, email, price_from, image_url, is_approved, level"
      )
      .eq("id", coachId)
      .maybeSingle(),
    supabase.from("coach_images").select("id").eq("coach_id", coachId),
    supabase.from("coach_socials").select("id").eq("coach_id", coachId),
    supabase
      .from("coach_venues")
      .select("id")
      .eq("coach_id", coachId)
      .eq("status", "active"),
    supabase
      .from("coach_attributes")
      .select("audience_adults, audience_juniors, player_levels")
      .eq("coach_id", coachId)
      .maybeSingle(),
    supabase
      .from("coach_outcomes")
      .select("outcome, outcome_key")
      .eq("coach_id", coachId),
    supabase
      .from("coach_locations")
      .select("city, country, is_primary")
      .eq("coach_id", coachId),
    supabase.from("coach_achievements").select("id").eq("coach_id", coachId),
    supabase
      .from("coach_booking_requests")
      .select("id")
      .eq("coach_id", coachId)
      .eq("status", "requested")
      .gte("starts_at", new Date().toISOString()),
    supabase
      .from("coach_profile_applications")
      .select("id")
      .eq("coach_id", coachId)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (coachResult.error || !coachResult.data) return null;

  const locations = locationsResult.data ?? [];
  const primary =
    locations.find((row) => row.is_primary) ?? locations[0] ?? null;
  const primaryLocation = primary
    ? [primary.city, primary.country].filter(Boolean).join(", ")
    : null;
  const playerLevels = Array.isArray(attributesResult.data?.player_levels)
    ? (attributesResult.data?.player_levels as string[])
    : [];
  const outcomes = (outcomesResult.data ?? []).map(
    (row) =>
      (row.outcome_key ? String(row.outcome_key) : null) || String(row.outcome)
  );
  const relationshipIds = (venuesResult.data ?? []).map((row) => String(row.id));
  let availabilityLive = false;
  if (relationshipIds.length > 0) {
    const { data: settings } = await supabase
      .from("coach_venue_availability_settings")
      .select("id")
      .in("coach_venue_id", relationshipIds)
      .eq("is_public", true)
      .limit(1);
    availabilityLive = Boolean(settings?.length);
  }
  const venueCount = relationshipIds.length;
  const imageCount = imagesResult.data?.length ?? 0;
  const socialCount = socialsResult.data?.length ?? 0;
  const achievementCount = achievementsResult.data?.length ?? 0;
  const pendingBookingCount = bookingsResult.data?.length ?? 0;
  const coach = coachResult.data as OpsCoachOverview["coach"];

  const completion = buildCoachCompletion(coach.id, {
    name: coach.name,
    role: coach.role,
    description: coach.description,
    experience_years: coach.experience_years,
    phone: coach.phone,
    email: coach.email,
    price_from: coach.price_from,
    image_url: coach.image_url,
    is_approved: coach.is_approved,
    hasPrimaryLocation: Boolean(primaryLocation),
    audienceAdults: Boolean(attributesResult.data?.audience_adults),
    audienceJuniors: Boolean(attributesResult.data?.audience_juniors),
    playerLevels,
    outcomes,
    imageCount,
    socialCount,
    achievementCount,
    activeVenueCount: venueCount,
    availabilityLive,
    pendingBookingCount,
  });

  return {
    coach,
    primaryLocation,
    hasPrimaryLocation: Boolean(primaryLocation),
    imageCount,
    socialCount,
    venueCount,
    achievementCount,
    audienceAdults: Boolean(attributesResult.data?.audience_adults),
    audienceJuniors: Boolean(attributesResult.data?.audience_juniors),
    playerLevels,
    outcomes,
    availabilityLive,
    pendingBookingCount,
    applicationId: applicationResult.data?.id
      ? String(applicationResult.data.id)
      : null,
    completion,
  };
}

export async function loadOpsVenueOverview(
  venueId: string
): Promise<OpsVenueOverview | null> {
  await requireAdminPermission("profiles.read");
  const supabase = await createClient();

  const [
    venueResult,
    imagesResult,
    socialsResult,
    coachesResult,
    applicationResult,
  ] = await Promise.all([
    supabase
      .from("venues")
      .select(
        "id, name, city, country, address, website, phone, courts, court_type, venue_type, coaching_description, opening_hours_structured, is_approved"
      )
      .eq("id", venueId)
      .maybeSingle(),
    supabase.from("venue_images").select("id").eq("venue_id", venueId),
    supabase.from("venue_socials").select("id").eq("venue_id", venueId),
    supabase
      .from("coach_venues")
      .select("id")
      .eq("venue_id", venueId)
      .eq("status", "active"),
    supabase
      .from("venue_profile_applications")
      .select("id")
      .or(`approved_venue_id.eq.${venueId},target_venue_id.eq.${venueId}`)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (venueResult.error || !venueResult.data) return null;

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

  const venue = venueResult.data as OpsVenueOverview["venue"];
  const imageCount = imagesResult.data?.length ?? 0;
  const socialCount = socialsResult.data?.length ?? 0;
  const activeCoachCount = relationshipIds.length;
  const completion = buildVenueCompletion(venue.id, {
    name: venue.name,
    city: venue.city,
    country: venue.country,
    address: venue.address,
    website: venue.website,
    phone: venue.phone,
    courts: venue.courts,
    courtType: venue.court_type,
    venueType: venue.venue_type,
    hasOpeningHours: Boolean(
      getStructuredOpeningHours(venue.opening_hours_structured)
    ),
    imageCount,
    socialCount,
    hasCoachingDescription: Boolean(venue.coaching_description?.trim()),
    activeCoachCount,
    hasCoachAvailability,
    isVerified: Boolean(venue.is_approved),
  });

  return {
    venue,
    imageCount,
    socialCount,
    activeCoachCount,
    hasCoachAvailability,
    applicationId: applicationResult.data?.id
      ? String(applicationResult.data.id)
      : null,
    completion,
  };
}
