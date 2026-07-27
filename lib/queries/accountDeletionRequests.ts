import "server-only";

import { buildDeletionInsertPayload } from "@/lib/accountDeletion/payload";
import {
  ACTIVE_OPEN,
  isAccountDeletionStatus,
  type AccountDeletionRequest,
  type AccountDeletionStatus,
  type AdminDeletionRequestDetail,
  type DeletionResponsibilitySummary,
} from "@/lib/accountDeletion/types";
import { ACTIVE_APPLICATION_STATUSES } from "@/lib/coachProfileApplication/constants";
import { requireAdminAccount } from "@/lib/auth/adminSession";
import { createClient } from "@/lib/supabase/server";
import type { VenueApplicationStatus } from "@/lib/venueProfileApplication/constants";

const ACTIVE_VENUE_APPLICATION_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "changes_requested",
] as const satisfies readonly VenueApplicationStatus[];

const DELETION_SELECT = `
  id, user_id, requester_email, status, reason,
  requested_at, cancelled_at, processed_at, created_at, updated_at
`;

function asDeletionRequest(
  row: Record<string, unknown>
): AccountDeletionRequest {
  const statusRaw = String(row.status ?? "");
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    requester_email: String(row.requester_email ?? ""),
    status: isAccountDeletionStatus(statusRaw)
      ? statusRaw
      : ("requested" as AccountDeletionStatus),
    reason: (row.reason as string | null) ?? null,
    requested_at: String(row.requested_at),
    cancelled_at: (row.cancelled_at as string | null) ?? null,
    processed_at: (row.processed_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function loadOwnDeletionRequest(
  userId: string
): Promise<AccountDeletionRequest | null> {
  const supabase = await createClient();

  const { data: openRow, error: openError } = await supabase
    .from("account_deletion_requests")
    .select(DELETION_SELECT)
    .eq("user_id", userId)
    .in("status", [...ACTIVE_OPEN])
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openError) {
    throw new Error("Unable to load deletion request.");
  }
  if (openRow) return asDeletionRequest(openRow as Record<string, unknown>);

  const { data: latest, error: latestError } = await supabase
    .from("account_deletion_requests")
    .select(DELETION_SELECT)
    .eq("user_id", userId)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    throw new Error("Unable to load deletion request.");
  }
  if (!latest) return null;
  return asDeletionRequest(latest as Record<string, unknown>);
}

export async function createDeletionRequest(input: {
  userId: string;
  reason: string | null;
}): Promise<{ request: AccountDeletionRequest } | { error: { code?: string; message: string } }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("account_deletion_requests")
    .insert(buildDeletionInsertPayload({ userId: input.userId, reason: input.reason }))
    .select(DELETION_SELECT)
    .maybeSingle();

  if (error || !data) {
    return {
      error: {
        code: error?.code,
        message: error?.message ?? "Unable to create deletion request.",
      },
    };
  }

  return { request: asDeletionRequest(data as Record<string, unknown>) };
}

export async function cancelDeletionRequest(input: {
  requestId: string;
  userId: string;
}): Promise<{ request: AccountDeletionRequest } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("account_deletion_requests")
    .update({ status: "cancelled" })
    .eq("id", input.requestId)
    .eq("user_id", input.userId)
    .eq("status", "requested")
    .select(DELETION_SELECT)
    .maybeSingle();

  if (error || !data) {
    return {
      error:
        error?.message ??
        "This deletion request can no longer be cancelled.",
    };
  }

  return { request: asDeletionRequest(data as Record<string, unknown>) };
}

export async function loadDeletionResponsibilitySummary(
  userId: string
): Promise<DeletionResponsibilitySummary> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [
    { count: coachCount, error: coachError },
    { count: venueCount, error: venueError },
    { count: futurePlayerBookings, error: playerError },
    { data: memberships, error: membershipError },
  ] = await Promise.all([
    supabase
      .from("coach_memberships")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("venue_memberships")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("coach_booking_requests")
      .select("id", { count: "exact", head: true })
      .eq("requester_user_id", userId)
      .in("status", ["requested", "accepted"])
      .gte("starts_at", nowIso),
    supabase
      .from("coach_memberships")
      .select("coach_id")
      .eq("user_id", userId),
  ]);

  if (coachError || venueError || playerError || membershipError) {
    throw new Error("Unable to load account responsibility summary.");
  }

  const coachIds = (memberships ?? []).map((row) => String(row.coach_id));
  let coachPendingBookings = 0;
  if (coachIds.length > 0) {
    const { count, error } = await supabase
      .from("coach_booking_requests")
      .select("id", { count: "exact", head: true })
      .in("coach_id", coachIds)
      .eq("status", "requested")
      .gte("starts_at", nowIso);
    if (error) {
      throw new Error("Unable to load account responsibility summary.");
    }
    coachPendingBookings = count ?? 0;
  }

  return {
    coachCount: coachCount ?? 0,
    venueCount: venueCount ?? 0,
    futurePlayerBookings: futurePlayerBookings ?? 0,
    coachPendingBookings,
  };
}

export type AdminDeletionListFilters = {
  statuses?: AccountDeletionStatus[];
};

export type AdminDeletionListItem = AccountDeletionRequest & {
  responsibility: DeletionResponsibilitySummary;
  profileName: string | null;
};

export async function listAdminDeletionRequests(
  filters: AdminDeletionListFilters = {}
): Promise<AdminDeletionListItem[]> {
  await requireAdminAccount();
  const supabase = await createClient();

  const statuses =
    filters.statuses && filters.statuses.length > 0
      ? filters.statuses
      : (["requested", "processing"] as AccountDeletionStatus[]);

  let query = supabase
    .from("account_deletion_requests")
    .select(DELETION_SELECT)
    .order("requested_at", { ascending: true });

  if (statuses.length) {
    query = query.in("status", statuses);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error("Unable to load deletion requests.");
  }

  const rows = ((data ?? []) as Record<string, unknown>[]).map(
    asDeletionRequest
  );
  if (rows.length === 0) return [];

  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);

  const nameById = new Map<string, string | null>();
  for (const profile of profiles ?? []) {
    nameById.set(
      String(profile.id),
      typeof profile.full_name === "string"
        ? profile.full_name.trim() || null
        : null
    );
  }

  const withSummary = await Promise.all(
    rows.map(async (request) => ({
      ...request,
      profileName: nameById.get(request.user_id) ?? null,
      responsibility: await loadDeletionResponsibilitySummary(request.user_id),
    }))
  );

  return withSummary;
}

export async function loadAdminDeletionRequestDetail(
  id: string
): Promise<AdminDeletionRequestDetail | null> {
  await requireAdminAccount();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("account_deletion_requests")
    .select(DELETION_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load deletion request.");
  }
  if (!data) return null;

  const request = asDeletionRequest(data as Record<string, unknown>);
  const userId = request.user_id;
  const nowIso = new Date().toISOString();

  const [
    { data: profile },
    { data: coachMemberships },
    { data: venueMemberships },
    { count: coachApps },
    { count: venueApps },
    { count: futurePlayer },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, avatar_path")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("coach_memberships")
      .select("coach_id, membership_role, coaches ( id, name )")
      .eq("user_id", userId),
    supabase
      .from("venue_memberships")
      .select("venue_id, membership_role, venues ( id, name )")
      .eq("user_id", userId),
    supabase
      .from("coach_profile_applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", [...ACTIVE_APPLICATION_STATUSES]),
    supabase
      .from("venue_profile_applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", [...ACTIVE_VENUE_APPLICATION_STATUSES]),
    supabase
      .from("coach_booking_requests")
      .select("id", { count: "exact", head: true })
      .eq("requester_user_id", userId)
      .in("status", ["requested", "accepted"])
      .gte("starts_at", nowIso),
  ]);

  const coaches = (coachMemberships ?? []).map((row) => {
    const coach = one(
      row.coaches as
        | { id: string; name: string | null }
        | { id: string; name: string | null }[]
        | null
    );
    return {
      id: String(row.coach_id),
      name: coach?.name?.trim() || "Coach profile",
      membershipRole:
        typeof row.membership_role === "string" ? row.membership_role : null,
    };
  });

  const venues = (venueMemberships ?? []).map((row) => {
    const venue = one(
      row.venues as
        | { id: string; name: string | null }
        | { id: string; name: string | null }[]
        | null
    );
    return {
      id: String(row.venue_id),
      name: venue?.name?.trim() || "Venue",
      membershipRole:
        typeof row.membership_role === "string" ? row.membership_role : null,
    };
  });

  const coachIds = coaches.map((coach) => coach.id);
  const venueIds = venues.map((venue) => venue.id);

  let coachPending = 0;
  if (coachIds.length > 0) {
    const { count } = await supabase
      .from("coach_booking_requests")
      .select("id", { count: "exact", head: true })
      .in("coach_id", coachIds)
      .eq("status", "requested")
      .gte("starts_at", nowIso);
    coachPending = count ?? 0;
  }

  let coachRelationships = 0;
  let venueRelationships = 0;
  if (coachIds.length > 0) {
    const { count } = await supabase
      .from("coach_venues")
      .select("id", { count: "exact", head: true })
      .in("coach_id", coachIds)
      .in("status", ["active", "pending", "unverified"]);
    coachRelationships = count ?? 0;
  }
  if (venueIds.length > 0) {
    const { count } = await supabase
      .from("coach_venues")
      .select("id", { count: "exact", head: true })
      .in("venue_id", venueIds)
      .in("status", ["active", "pending", "unverified"]);
    venueRelationships = count ?? 0;
  }

  return {
    request,
    profileName:
      typeof profile?.full_name === "string"
        ? profile.full_name.trim() || null
        : null,
    coaches,
    venues,
    applicationCounts: {
      coach: coachApps ?? 0,
      venue: venueApps ?? 0,
    },
    relationshipCounts: {
      coach: coachRelationships,
      venue: venueRelationships,
    },
    bookingCounts: {
      futurePlayer: futurePlayer ?? 0,
      coachPending,
    },
    hasAccountAvatar: Boolean(
      typeof profile?.avatar_path === "string" && profile.avatar_path.trim()
    ),
  };
}

export async function adminUpdateDeletionRequestStatus(input: {
  requestId: string;
  status: "processing" | "declined" | "cancelled";
}): Promise<{ request: AccountDeletionRequest } | { error: string }> {
  await requireAdminAccount("not-found");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("account_deletion_requests")
    .update({ status: input.status })
    .eq("id", input.requestId)
    .select(DELETION_SELECT)
    .maybeSingle();

  if (error || !data) {
    return {
      error: error?.message ?? "The deletion request could not be updated.",
    };
  }

  return { request: asDeletionRequest(data as Record<string, unknown>) };
}
