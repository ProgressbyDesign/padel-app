import "server-only";

import { requireAuthenticatedAccount } from "@/lib/auth/session";
import {
  isEditableApplicationStatus,
  type CoachApplicationStatus,
} from "@/lib/coachProfileApplication/constants";
import type {
  CoachApplicationLocationRow,
  CoachApplicationWithLocations,
  CoachProfileApplicationRow,
} from "@/lib/coachProfileApplication/types";
import { createClient } from "@/lib/supabase/server";

const APPLICATION_SELECT = `
  id,
  user_id,
  status,
  current_step,
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

function asApplication(
  row: Record<string, unknown>
): CoachProfileApplicationRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    status: row.status as CoachApplicationStatus,
    current_step: Number(row.current_step),
    full_name: (row.full_name as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    coaching_role: (row.coaching_role as CoachProfileApplicationRow["coaching_role"]) ?? null,
    coaching_role_other: (row.coaching_role_other as string | null) ?? null,
    experience_years: (row.experience_years as number | null) ?? null,
    description: (row.description as string | null) ?? null,
    player_levels: (row.player_levels as CoachProfileApplicationRow["player_levels"]) ?? [],
    audiences: (row.audiences as CoachProfileApplicationRow["audiences"]) ?? [],
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

export async function loadCurrentCoachApplication(): Promise<CoachApplicationWithLocations | null> {
  const account = await requireAuthenticatedAccount("/account/applications/coach");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("coach_profile_applications")
    .select(APPLICATION_SELECT)
    .eq("user_id", account.id)
    .in("status", [
      "draft",
      "submitted",
      "under_review",
      "changes_requested",
      "approved",
    ])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!error && data) {
    const application = asApplication(data as Record<string, unknown>);
    const locations = await loadApplicationLocations(application.id);
    return { application, locations };
  }

  // Fallback: latest declined/withdrawn for account overview context
  const latest = await supabase
    .from("coach_profile_applications")
    .select(APPLICATION_SELECT)
    .eq("user_id", account.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest.error || !latest.data) return null;
  const application = asApplication(latest.data as Record<string, unknown>);
  const locations = await loadApplicationLocations(application.id);
  return { application, locations };
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
