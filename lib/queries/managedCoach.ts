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
  imageCount: number;
  socialCount: number;
  venueCount: number;
  audienceAdults: boolean;
  audienceJuniors: boolean;
  outcomes: string[];
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
      .select("venue_id")
      .eq("coach_id", coachId),
    supabase
      .from("coach_attributes")
      .select("audience_adults, audience_juniors")
      .eq("coach_id", coachId)
      .maybeSingle(),
    supabase
      .from("coach_outcomes")
      .select("outcome")
      .eq("coach_id", coachId),
  ]);

  if (coachResult.error || !coachResult.data) return null;

  return {
    coach: coachResult.data as ManagedCoachDetail,
    membershipRole: shell.membershipRole,
    primaryLocation: shell.primaryLocation,
    imageCount: imagesResult.data?.length ?? 0,
    socialCount: socialsResult.data?.length ?? 0,
    venueCount: venuesResult.data?.length ?? 0,
    audienceAdults: Boolean(attributesResult.data?.audience_adults),
    audienceJuniors: Boolean(attributesResult.data?.audience_juniors),
    outcomes: (outcomesResult.data ?? []).map((row) => String(row.outcome)),
  };
}

export async function loadManagedCoachDetails(
  coachId: string
): Promise<{
  coach: ManagedCoachDetail;
  membershipRole: MembershipRole;
  audienceAdults: boolean;
  audienceJuniors: boolean;
  outcomes: string[];
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
      .select("audience_adults, audience_juniors")
      .eq("coach_id", coachId)
      .maybeSingle(),
    supabase
      .from("coach_outcomes")
      .select("outcome")
      .eq("coach_id", coachId),
  ]);

  if (coachResult.error || !coachResult.data) return null;

  return {
    coach: coachResult.data as ManagedCoachDetail,
    membershipRole: shell.membershipRole,
    audienceAdults: Boolean(attributesResult.data?.audience_adults),
    audienceJuniors: Boolean(attributesResult.data?.audience_juniors),
    outcomes: (outcomesResult.data ?? []).map((row) => String(row.outcome)),
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
    }[]
  | null
> {
  const shell = await assertManagedCoachAccess(coachId);
  if (!shell) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_images")
    .select("id, image_url, is_primary")
    .eq("coach_id", coachId)
    .order("is_primary", { ascending: false });
  if (error) return null;
  return (data ?? []) as {
    id: string;
    image_url: string;
    is_primary: boolean | null;
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
