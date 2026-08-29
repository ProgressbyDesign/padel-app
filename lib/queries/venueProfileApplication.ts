import "server-only";

import { requireAuthenticatedAccount } from "@/lib/auth/session";
import {
  isEditableVenueApplicationStatus,
  type VenueApplicationStatus,
} from "@/lib/venueProfileApplication/constants";
import type {
  VenueApplicationTargetVenue,
  VenueApplicationWithVenue,
  VenueProfileApplicationRow,
} from "@/lib/venueProfileApplication/types";
import { createClient } from "@/lib/supabase/server";
import { VENUE_PUBLIC_PROFILES_TABLE } from "@/lib/publicProfiles";

const APPLICATION_SELECT = `
  id,
  user_id,
  status,
  current_step,
  application_mode,
  relationship_to_venue,
  target_venue_id,
  applicant_email,
  proposed_venue_name,
  proposed_country,
  proposed_city,
  proposed_address,
  proposed_website,
  phone,
  supporting_note,
  terms_accepted_at,
  privacy_accepted_at,
  submitted_at,
  approved_venue_id,
  approved_membership_role,
  reviewed_at,
  reviewed_by_user_id,
  review_note,
  created_at,
  updated_at
`;

function asApplication(row: Record<string, unknown>): VenueProfileApplicationRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    status: row.status as VenueApplicationStatus,
    current_step: Number(row.current_step),
    application_mode:
      (row.application_mode as VenueProfileApplicationRow["application_mode"]) ??
      null,
    relationship_to_venue:
      (row.relationship_to_venue as VenueProfileApplicationRow["relationship_to_venue"]) ??
      null,
    target_venue_id: (row.target_venue_id as string | null) ?? null,
    applicant_email: (row.applicant_email as string | null) ?? null,
    proposed_venue_name: (row.proposed_venue_name as string | null) ?? null,
    proposed_country:
      (row.proposed_country as VenueProfileApplicationRow["proposed_country"]) ??
      null,
    proposed_city: (row.proposed_city as string | null) ?? null,
    proposed_address: (row.proposed_address as string | null) ?? null,
    proposed_website: (row.proposed_website as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    supporting_note: (row.supporting_note as string | null) ?? null,
    terms_accepted_at: (row.terms_accepted_at as string | null) ?? null,
    privacy_accepted_at: (row.privacy_accepted_at as string | null) ?? null,
    submitted_at: (row.submitted_at as string | null) ?? null,
    approved_venue_id: (row.approved_venue_id as string | null) ?? null,
    approved_membership_role:
      (row.approved_membership_role as VenueProfileApplicationRow["approved_membership_role"]) ??
      null,
    reviewed_at: (row.reviewed_at as string | null) ?? null,
    reviewed_by_user_id: (row.reviewed_by_user_id as string | null) ?? null,
    review_note: (row.review_note as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function loadTargetVenue(
  venueId: string | null
): Promise<VenueApplicationTargetVenue | null> {
  if (!venueId) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(VENUE_PUBLIC_PROFILES_TABLE)
    .select("id, name, city, country, image_url")
    .eq("id", venueId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: String(data.id),
    name: (data.name as string | null) ?? null,
    city: (data.city as string | null) ?? null,
    country: (data.country as string | null) ?? null,
    image_url: (data.image_url as string | null) ?? null,
    website: null,
  };
}

export async function loadCurrentVenueApplication(): Promise<VenueApplicationWithVenue | null> {
  const account = await requireAuthenticatedAccount(
    "/account/applications/venue"
  );
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("venue_profile_applications")
    .select(APPLICATION_SELECT)
    .eq("user_id", account.id)
    .in("status", [
      "draft",
      "submitted",
      "under_review",
      "changes_requested",
    ])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const application = asApplication(data as Record<string, unknown>);
  const targetVenue = await loadTargetVenue(application.target_venue_id);
  return { application, targetVenue };
}

/** Latest application for the signed-in user, including approved/history rows. */
export async function loadLatestVenueApplication(): Promise<VenueApplicationWithVenue | null> {
  const account = await requireAuthenticatedAccount(
    "/account/applications/venue"
  );
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("venue_profile_applications")
    .select(APPLICATION_SELECT)
    .eq("user_id", account.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const application = asApplication(data as Record<string, unknown>);
  const targetVenue = await loadTargetVenue(
    application.target_venue_id ?? application.approved_venue_id
  );
  return { application, targetVenue };
}

export async function loadUserVenueApplications(): Promise<
  VenueProfileApplicationRow[]
> {
  const account = await requireAuthenticatedAccount("/account/applications");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("venue_profile_applications")
    .select(APPLICATION_SELECT)
    .eq("user_id", account.id)
    .order("updated_at", { ascending: false });
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map(asApplication);
}

export async function loadOwnedEditableVenueApplication(
  applicationId: string,
  userId: string
): Promise<VenueProfileApplicationRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("venue_profile_applications")
    .select(APPLICATION_SELECT)
    .eq("id", applicationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const application = asApplication(data as Record<string, unknown>);
  if (!isEditableVenueApplicationStatus(application.status)) return null;
  return application;
}

export async function loadOwnedVenueApplication(
  applicationId: string,
  userId: string
): Promise<VenueProfileApplicationRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("venue_profile_applications")
    .select(APPLICATION_SELECT)
    .eq("id", applicationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return asApplication(data as Record<string, unknown>);
}

export async function searchVenuesForApplication(
  term: string
): Promise<VenueApplicationTargetVenue[]> {
  void term;
  // Public claiming is disabled; do not expose imported venues for applicants.
  return [];
}
