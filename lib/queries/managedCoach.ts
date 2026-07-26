import "server-only";

import type { MembershipRole } from "@/lib/auth/types";
import {
  sortCoachSocials,
  type CoachSocialRow,
} from "@/lib/coachSocials";
import { createClient } from "@/lib/supabase/server";
import {
  isValidCoachId,
  loadManagedCoachShell,
} from "@/lib/queries/managedCoachShell";
import { coachHasLivePublicAvailability } from "@/lib/queries/coachAvailability";

export { isValidCoachId };

export type ManagedCoachDetail = {
  id: string;
  name: string | null;
  role: string | null;
  description: string | null;
  experience_years: number | null;
  phone: string | null;
  email: string | null;
  travel_available: boolean | null;
  price_from: number | null;
  image_url: string | null;
  is_approved: boolean | null;
  data_quality_status: string | null;
  level: string | null;
};

export type ManagedCoachOverview = {
  coach: ManagedCoachDetail;
  membershipRole: MembershipRole;
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
  availabilityStatus: "none" | "private" | "live";
  nextAvailableAt: string | null;
  availabilityComplete: boolean;
  pricingConfigured: boolean;
  pendingBookingCount: number;
};

async function assertManagedCoachAccess(coachId: string) {
  return loadManagedCoachShell(coachId);
}

export async function loadManagedCoachOverview(
  coachId: string
): Promise<ManagedCoachOverview | null> {
  const shell = await assertManagedCoachAccess(coachId);
  if (!shell) return null;

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
  ] = await Promise.all([
    supabase
      .from("coaches")
      .select(
        `
        id,
        name,
        role,
        description,
        experience_years,
        phone,
        email,
        travel_available,
        price_from,
        image_url,
        is_approved,
        data_quality_status,
        level
      `
      )
      .eq("id", coachId)
      .maybeSingle(),
    supabase
      .from("coach_images")
      .select("id")
      .eq("coach_id", coachId),
    supabase
      .from("coach_socials")
      .select("id")
      .eq("coach_id", coachId),
    supabase
      .from("coach_venues")
      .select("id, venue_id")
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
      .select("id, is_primary")
      .eq("coach_id", coachId),
    supabase
      .from("coach_achievements")
      .select("id")
      .eq("coach_id", coachId),
    supabase
      .from("coach_booking_requests")
      .select("id")
      .eq("coach_id", coachId)
      .eq("status", "requested")
      .gte("starts_at", new Date().toISOString()),
  ]);

  if (coachResult.error || !coachResult.data) return null;

  const relationshipIds = (venuesResult.data ?? []).map((row) =>
    String(row.id)
  );
  let pricingConfigured = false;
  if (relationshipIds.length > 0) {
    const { data: pricingRows } = await supabase
      .from("coach_venue_availability_settings")
      .select("currency, default_hourly_rate_minor")
      .in("coach_venue_id", relationshipIds);
    pricingConfigured = (pricingRows ?? []).some(
      (row) =>
        Boolean(typeof row.currency === "string" && row.currency.trim()) &&
        row.default_hourly_rate_minor != null
    );
  }

  const availability = await coachHasLivePublicAvailability(coachId);
  const locations = locationsResult.data ?? [];
  const hasPrimaryLocation =
    locations.some((row) => row.is_primary) || locations.length > 0;

  return {
    coach: coachResult.data as ManagedCoachDetail,
    membershipRole: shell.membershipRole,
    primaryLocation: shell.primaryLocation,
    hasPrimaryLocation,
    imageCount: imagesResult.data?.length ?? 0,
    socialCount: socialsResult.data?.length ?? 0,
    venueCount: venuesResult.data?.length ?? 0,
    achievementCount: achievementsResult.data?.length ?? 0,
    audienceAdults: Boolean(attributesResult.data?.audience_adults),
    audienceJuniors: Boolean(attributesResult.data?.audience_juniors),
    playerLevels: Array.isArray(attributesResult.data?.player_levels)
      ? (attributesResult.data?.player_levels as string[])
      : [],
    outcomes: (outcomesResult.data ?? []).map(
      (row) =>
        (row.outcome_key ? String(row.outcome_key) : null) ||
        String(row.outcome)
    ),
    availabilityStatus: availability.status,
    nextAvailableAt: availability.nextSlotStartsAt,
    availabilityComplete: availability.status === "live",
    pricingConfigured,
    pendingBookingCount: bookingsResult.data?.length ?? 0,
  };
}

export async function loadManagedCoachDetails(
  coachId: string
): Promise<{
  coach: ManagedCoachDetail;
  membershipRole: MembershipRole;
  audienceAdults: boolean;
  audienceJuniors: boolean;
  playerLevels: string[];
  outcomes: Array<{ outcome: string; outcome_key: string | null }>;
} | null> {
  const shell = await assertManagedCoachAccess(coachId);
  if (!shell) return null;

  const supabase = await createClient();
  const [coachResult, attributesResult, outcomesResult] = await Promise.all([
    supabase
      .from("coaches")
      .select(
        `
        id,
        name,
        role,
        description,
        experience_years,
        phone,
        email,
        travel_available,
        price_from,
        image_url,
        is_approved,
        data_quality_status,
        level
      `
      )
      .eq("id", coachId)
      .maybeSingle(),
    supabase
      .from("coach_attributes")
      .select("audience_adults, audience_juniors, player_levels")
      .eq("coach_id", coachId)
      .maybeSingle(),
    supabase
      .from("coach_outcomes")
      .select("outcome, outcome_key")
      .eq("coach_id", coachId),
  ]);

  if (coachResult.error || !coachResult.data) return null;

  return {
    coach: coachResult.data as ManagedCoachDetail,
    membershipRole: shell.membershipRole,
    audienceAdults: Boolean(attributesResult.data?.audience_adults),
    audienceJuniors: Boolean(attributesResult.data?.audience_juniors),
    playerLevels: Array.isArray(attributesResult.data?.player_levels)
      ? (attributesResult.data?.player_levels as string[])
      : [],
    outcomes: (outcomesResult.data ?? []).map((row) => ({
      outcome: String(row.outcome),
      outcome_key: row.outcome_key ? String(row.outcome_key) : null,
    })),
  };
}

export async function loadManagedCoachImageCount(
  coachId: string
): Promise<number | null> {
  const shell = await assertManagedCoachAccess(coachId);
  if (!shell) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_images")
    .select("id")
    .eq("coach_id", coachId);
  if (error) return null;
  return data?.length ?? 0;
}

export async function loadManagedCoachImages(
  coachId: string
): Promise<
  | {
      id: string;
      image_url: string;
      is_primary: boolean | null;
      created_at: string | null;
    }[]
  | null
> {
  const shell = await assertManagedCoachAccess(coachId);
  if (!shell) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_images")
    .select("id, image_url, is_primary, created_at")
    .eq("coach_id", coachId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) return null;
  return (data ?? []) as {
    id: string;
    image_url: string;
    is_primary: boolean | null;
    created_at: string | null;
  }[];
}

export async function loadManagedCoachSocials(
  coachId: string
): Promise<CoachSocialRow[] | null> {
  const shell = await assertManagedCoachAccess(coachId);
  if (!shell) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_socials")
    .select("id, coach_id, platform, url, is_primary, created_at")
    .eq("coach_id", coachId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) return null;
  return sortCoachSocials(
    ((data ?? []) as CoachSocialRow[]).map((row) => ({
      ...row,
      id: String(row.id),
      coach_id: String(row.coach_id),
      is_primary: Boolean(row.is_primary),
      created_at: row.created_at ?? null,
    }))
  );
}

export async function loadManagedCoachSocialCount(
  coachId: string
): Promise<number | null> {
  const socials = await loadManagedCoachSocials(coachId);
  if (!socials) return null;
  return socials.length;
}
