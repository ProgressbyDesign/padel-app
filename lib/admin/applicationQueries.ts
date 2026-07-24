import "server-only";

import { requireAdminAccount } from "@/lib/auth/adminSession";
import type { CoachApplicationStatus } from "@/lib/coachProfileApplication/constants";
import type {
  CoachApplicationLocationRow,
  CoachProfileApplicationRow,
} from "@/lib/coachProfileApplication/types";
import { createClient } from "@/lib/supabase/server";
import type {
  ApprovedMembershipRole,
  VenueApplicationStatus,
} from "@/lib/venueProfileApplication/constants";
import type {
  VenueApplicationTargetVenue,
  VenueProfileApplicationRow,
} from "@/lib/venueProfileApplication/types";

const COACH_APPLICATION_SELECT = `
  id, user_id, status, current_step, full_name, phone, coaching_role,
  coaching_role_other, experience_years, description, player_levels, audiences,
  outcomes, terms_accepted_at, privacy_accepted_at, submitted_at, coach_id,
  reviewed_at, reviewed_by_user_id, review_note, created_at, updated_at
`;

const VENUE_APPLICATION_SELECT = `
  id, user_id, status, current_step, application_mode, relationship_to_venue,
  target_venue_id, proposed_venue_name, proposed_country, proposed_city,
  proposed_address, proposed_website, phone, supporting_note, terms_accepted_at,
  privacy_accepted_at, submitted_at, approved_venue_id,
  approved_membership_role, reviewed_at, reviewed_by_user_id, review_note,
  created_at, updated_at
`;

export type ApplicationStatusCounts = Record<
  "submitted" | "under_review" | "changes_requested",
  number
>;

export type AdminCoachApplication = CoachProfileApplicationRow;
export type AdminVenueApplication = VenueProfileApplicationRow;

export type AdminVenueMembership = {
  venue_id: string;
  user_id: string;
  membership_role: ApprovedMembershipRole;
  created_at: string;
};

export type AdminCoachSearchResult = {
  id: string;
  name: string;
  role: string | null;
  experience_years: number | null;
  phone: string | null;
};

export type AdminVenueSearchResult = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  website: string | null;
};

export type AdminCoachApplicationDetail = {
  application: AdminCoachApplication;
  locations: CoachApplicationLocationRow[];
};

export type AdminVenueApplicationDetail = {
  application: AdminVenueApplication;
  targetVenue: VenueApplicationTargetVenue | null;
  approvedVenue: VenueApplicationTargetVenue | null;
  memberships: AdminVenueMembership[];
};

function coachApplication(row: Record<string, unknown>): AdminCoachApplication {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    status: row.status as CoachApplicationStatus,
    current_step: Number(row.current_step),
    full_name: (row.full_name as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    coaching_role:
      (row.coaching_role as AdminCoachApplication["coaching_role"]) ?? null,
    coaching_role_other: (row.coaching_role_other as string | null) ?? null,
    experience_years: (row.experience_years as number | null) ?? null,
    description: (row.description as string | null) ?? null,
    player_levels:
      (row.player_levels as AdminCoachApplication["player_levels"]) ?? [],
    audiences: (row.audiences as AdminCoachApplication["audiences"]) ?? [],
    outcomes: (row.outcomes as AdminCoachApplication["outcomes"]) ?? [],
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

function venueApplication(row: Record<string, unknown>): AdminVenueApplication {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    status: row.status as VenueApplicationStatus,
    current_step: Number(row.current_step),
    application_mode:
      (row.application_mode as AdminVenueApplication["application_mode"]) ?? null,
    relationship_to_venue:
      (row.relationship_to_venue as AdminVenueApplication["relationship_to_venue"]) ??
      null,
    target_venue_id: (row.target_venue_id as string | null) ?? null,
    proposed_venue_name: (row.proposed_venue_name as string | null) ?? null,
    proposed_country:
      (row.proposed_country as AdminVenueApplication["proposed_country"]) ?? null,
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
      (row.approved_membership_role as ApprovedMembershipRole | null) ?? null,
    reviewed_at: (row.reviewed_at as string | null) ?? null,
    reviewed_by_user_id: (row.reviewed_by_user_id as string | null) ?? null,
    review_note: (row.review_note as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function countTableStatuses(
  table: "coach_profile_applications" | "venue_profile_applications"
): Promise<ApplicationStatusCounts> {
  const supabase = await createClient();
  const statuses = ["submitted", "under_review", "changes_requested"] as const;
  const results = await Promise.all(
    statuses.map((status) =>
      supabase.from(table).select("id", { count: "exact", head: true }).eq("status", status)
    )
  );

  return Object.fromEntries(
    statuses.map((status, index) => {
      const result = results[index];
      if (result.error) throw new Error(`Unable to count ${table}: ${result.error.message}`);
      return [status, result.count ?? 0];
    })
  ) as ApplicationStatusCounts;
}

export async function countApplicationStatuses(): Promise<{
  coach: ApplicationStatusCounts;
  venue: ApplicationStatusCounts;
}> {
  await requireAdminAccount();
  const [coach, venue] = await Promise.all([
    countTableStatuses("coach_profile_applications"),
    countTableStatuses("venue_profile_applications"),
  ]);
  return { coach, venue };
}

export async function listCoachApplications({
  statuses,
}: {
  statuses: CoachApplicationStatus[];
}): Promise<AdminCoachApplication[]> {
  await requireAdminAccount();
  const supabase = await createClient();
  let query = supabase
    .from("coach_profile_applications")
    .select(COACH_APPLICATION_SELECT)
    .order("submitted_at", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false });
  if (statuses.length) query = query.in("status", statuses);
  const { data, error } = await query;
  if (error) throw new Error(`Unable to load coach applications: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map(coachApplication);
}

export async function getCoachApplicationDetail(
  id: string
): Promise<AdminCoachApplicationDetail | null> {
  await requireAdminAccount();
  const supabase = await createClient();
  const [applicationResult, locationResult] = await Promise.all([
    supabase
      .from("coach_profile_applications")
      .select(COACH_APPLICATION_SELECT)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("coach_application_locations")
      .select("id, application_id, country, city, is_primary, created_at")
      .eq("application_id", id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true }),
  ]);
  if (applicationResult.error) {
    throw new Error(`Unable to load coach application: ${applicationResult.error.message}`);
  }
  if (locationResult.error) {
    throw new Error(`Unable to load application locations: ${locationResult.error.message}`);
  }
  if (!applicationResult.data) return null;
  return {
    application: coachApplication(applicationResult.data as Record<string, unknown>),
    locations: (locationResult.data ?? []) as CoachApplicationLocationRow[],
  };
}

export async function listVenueApplications({
  statuses,
}: {
  statuses: VenueApplicationStatus[];
}): Promise<AdminVenueApplication[]> {
  await requireAdminAccount();
  const supabase = await createClient();
  let query = supabase
    .from("venue_profile_applications")
    .select(VENUE_APPLICATION_SELECT)
    .order("submitted_at", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false });
  if (statuses.length) query = query.in("status", statuses);
  const { data, error } = await query;
  if (error) throw new Error(`Unable to load venue applications: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map(venueApplication);
}

async function loadVenue(
  id: string | null
): Promise<VenueApplicationTargetVenue | null> {
  if (!id) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("venues")
    .select("id, name, city, country, image_url, website")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Unable to load venue: ${error.message}`);
  return (data as VenueApplicationTargetVenue | null) ?? null;
}

export async function getVenueApplicationDetail(
  id: string
): Promise<AdminVenueApplicationDetail | null> {
  await requireAdminAccount();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("venue_profile_applications")
    .select(VENUE_APPLICATION_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Unable to load venue application: ${error.message}`);
  if (!data) return null;

  const application = venueApplication(data as Record<string, unknown>);
  const membershipVenueId =
    application.target_venue_id ?? application.approved_venue_id;
  const [targetVenue, approvedVenue, membershipResult] = await Promise.all([
    loadVenue(application.target_venue_id),
    loadVenue(application.approved_venue_id),
    membershipVenueId
      ? supabase
          .from("venue_memberships")
          .select("venue_id, user_id, membership_role, created_at")
          .eq("venue_id", membershipVenueId)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (membershipResult.error) {
    throw new Error(`Unable to load venue memberships: ${membershipResult.error.message}`);
  }
  return {
    application,
    targetVenue,
    approvedVenue,
    memberships: (membershipResult.data ?? []) as AdminVenueMembership[],
  };
}

function safeSearchTerm(term: string): string {
  return term.trim().replace(/[%_,]/g, " ").replace(/\s+/g, " ").slice(0, 120);
}

export async function searchCoachesForAdminApproval(
  term: string
): Promise<AdminCoachSearchResult[]> {
  await requireAdminAccount();
  const q = safeSearchTerm(term);
  if (q.length < 2) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coaches")
    .select("id, name, role, experience_years, phone")
    .ilike("name", `%${q}%`)
    .order("name", { ascending: true })
    .limit(12);
  if (error) throw new Error(`Unable to search coaches: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: row.name?.trim() || "Unnamed coach",
    role: row.role ?? null,
    experience_years: row.experience_years ?? null,
    phone: row.phone ?? null,
  }));
}

export async function searchVenuesForAdminApproval(
  term: string
): Promise<AdminVenueSearchResult[]> {
  await requireAdminAccount();
  const q = safeSearchTerm(term);
  if (q.length < 2) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("venues")
    .select("id, name, city, country, website")
    .ilike("name", `%${q}%`)
    .order("name", { ascending: true })
    .limit(12);
  if (error) throw new Error(`Unable to search venues: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: row.name?.trim() || "Unnamed venue",
    city: row.city ?? null,
    country: row.country ?? null,
    website: row.website ?? null,
  }));
}
