import "server-only";

import { requireAuthenticatedAccount } from "@/lib/auth/session";
import {
  ACTIVE_APPLICATION_STATUSES,
  isApplicationCountry,
  isCoachApplicationMode,
  isEditableApplicationStatus,
  type CoachApplicationStatus,
} from "@/lib/coachProfileApplication/constants";
import type {
  CoachApplicationLocationRow,
  CoachApplicationWithLocations,
  CoachClaimTargetSummary,
  CoachProfileApplicationRow,
} from "@/lib/coachProfileApplication/types";
import { createClient } from "@/lib/supabase/server";

const APPLICATION_SELECT = `
  id,
  user_id,
  status,
  current_step,
  application_mode,
  target_coach_id,
  applicant_email,
  full_name,
  phone,
  coaching_role,
  coaching_role_other,
  experience_years,
  description,
  player_levels,
  audiences,
  outcomes,
  terms_accepted_at,
  privacy_accepted_at,
  submitted_at,
  coach_id,
  reviewed_at,
  reviewed_by_user_id,
  review_note,
  created_at,
  updated_at
`;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidCoachApplicationUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function asApplication(
  row: Record<string, unknown>
): CoachProfileApplicationRow {
  const modeRaw = row.application_mode;
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    status: row.status as CoachApplicationStatus,
    current_step: Number(row.current_step),
    application_mode: isCoachApplicationMode(
      typeof modeRaw === "string" ? modeRaw : null
    )
      ? (modeRaw as CoachProfileApplicationRow["application_mode"])
      : "create_new",
    target_coach_id: (row.target_coach_id as string | null) ?? null,
    applicant_email: (row.applicant_email as string | null) ?? null,
    full_name: (row.full_name as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    coaching_role:
      (row.coaching_role as CoachProfileApplicationRow["coaching_role"]) ?? null,
    coaching_role_other: (row.coaching_role_other as string | null) ?? null,
    experience_years: (row.experience_years as number | null) ?? null,
    description: (row.description as string | null) ?? null,
    player_levels:
      (row.player_levels as CoachProfileApplicationRow["player_levels"]) ?? [],
    audiences:
      (row.audiences as CoachProfileApplicationRow["audiences"]) ?? [],
    outcomes: (row.outcomes as CoachProfileApplicationRow["outcomes"]) ?? [],
    terms_accepted_at: (row.terms_accepted_at as string | null) ?? null,
    privacy_accepted_at: (row.privacy_accepted_at as string | null) ?? null,
    submitted_at: (row.submitted_at as string | null) ?? null,
    coach_id: (row.coach_id as string | null) ?? null,
    reviewed_at: (row.reviewed_at as string | null) ?? null,
    reviewed_by_user_id: (row.reviewed_by_user_id as string | null) ?? null,
    review_note: (row.review_note as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function asLocation(row: Record<string, unknown>): CoachApplicationLocationRow {
  return {
    id: String(row.id),
    application_id: String(row.application_id),
    country: String(row.country),
    city: String(row.city),
    is_primary: Boolean(row.is_primary),
    created_at: String(row.created_at),
  };
}

async function withTargetCoach(
  application: CoachProfileApplicationRow
): Promise<CoachApplicationWithLocations> {
  const locations = await loadApplicationLocations(application.id);
  const targetCoach = application.target_coach_id
    ? await loadTargetCoachSummary(application.target_coach_id)
    : null;
  return { application, locations, targetCoach };
}

export async function loadTargetCoachSummary(
  coachId: string
): Promise<CoachClaimTargetSummary | null> {
  if (!isValidCoachApplicationUuid(coachId)) return null;
  const supabase = await createClient();
  const { data: coach, error } = await supabase
    .from("coaches")
    .select("id, name, role, image_url, is_claimed")
    .eq("id", coachId)
    .maybeSingle();
  if (error || !coach) return null;

  const [{ data: locations }, { data: venueLinks }] = await Promise.all([
    supabase
      .from("coach_locations")
      .select("country, city, is_primary")
      .eq("coach_id", coachId)
      .order("is_primary", { ascending: false }),
    supabase
      .from("coach_venues")
      .select("is_primary, status, venues ( name, city, country )")
      .eq("coach_id", coachId)
      .in("status", ["active", "unverified"])
      .order("is_primary", { ascending: false })
      .limit(3),
  ]);

  const primaryLoc = (locations ?? []).find((row) => row.is_primary) ??
    (locations ?? [])[0];
  let primaryLocation: string | null = null;
  if (primaryLoc) {
    primaryLocation = [primaryLoc.city, primaryLoc.country]
      .filter(Boolean)
      .join(", ");
  }

  let venueName: string | null = null;
  for (const link of venueLinks ?? []) {
    const venue = link.venues as {
      name?: string | null;
      city?: string | null;
      country?: string | null;
    } | null;
    if (venue?.name?.trim()) {
      venueName = venue.name.trim();
      if (!primaryLocation) {
        primaryLocation = [venue.city, venue.country]
          .filter(Boolean)
          .join(", ");
      }
      break;
    }
  }

  return {
    id: String(coach.id),
    name: (coach.name as string | null) ?? null,
    role: (coach.role as string | null) ?? null,
    image_url: (coach.image_url as string | null) ?? null,
    primaryLocation,
    venueName,
    is_claimed: Boolean(coach.is_claimed),
  };
}

export async function loadClaimTargetCoach(
  coachId: string
): Promise<CoachClaimTargetSummary | null> {
  const summary = await loadTargetCoachSummary(coachId);
  if (!summary || summary.is_claimed) return null;
  return summary;
}

export async function searchClaimableCoaches(
  term: string,
  userId: string
): Promise<CoachClaimTargetSummary[]> {
  void term;
  void userId;
  // Public claiming is disabled; keep the helper for call-site compatibility.
  return [];
}

export async function loadCurrentCoachApplication(): Promise<CoachApplicationWithLocations | null> {
  const account = await requireAuthenticatedAccount(
    "/account/applications/coach"
  );
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("coach_profile_applications")
    .select(APPLICATION_SELECT)
    .eq("user_id", account.id)
    .in("status", [...ACTIVE_APPLICATION_STATUSES])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return withTargetCoach(asApplication(data as Record<string, unknown>));
}

export async function loadLatestCoachApplication(): Promise<CoachApplicationWithLocations | null> {
  const account = await requireAuthenticatedAccount(
    "/account/applications/coach"
  );
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_profile_applications")
    .select(APPLICATION_SELECT)
    .eq("user_id", account.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return withTargetCoach(asApplication(data as Record<string, unknown>));
}

export async function loadActiveCoachApplication(): Promise<CoachApplicationWithLocations | null> {
  return loadCurrentCoachApplication();
}

export async function loadUserCoachApplications(): Promise<
  CoachProfileApplicationRow[]
> {
  const account = await requireAuthenticatedAccount("/account/applications");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("coach_profile_applications")
    .select(APPLICATION_SELECT)
    .eq("user_id", account.id)
    .order("updated_at", { ascending: false });

  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map(asApplication);
}

export async function loadApplicationLocations(
  applicationId: string
): Promise<CoachApplicationLocationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_application_locations")
    .select("id, application_id, country, city, is_primary, created_at")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true });

  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map(asLocation);
}

export async function loadOwnedEditableApplication(
  applicationId: string,
  userId: string
): Promise<CoachProfileApplicationRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_profile_applications")
    .select(APPLICATION_SELECT)
    .eq("id", applicationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  const application = asApplication(data as Record<string, unknown>);
  if (!isEditableApplicationStatus(application.status)) return null;
  return application;
}

export async function loadOwnedApplication(
  applicationId: string,
  userId: string
): Promise<CoachProfileApplicationRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_profile_applications")
    .select(APPLICATION_SELECT)
    .eq("id", applicationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return asApplication(data as Record<string, unknown>);
}

export { isApplicationCountry };
