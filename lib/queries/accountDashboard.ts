import "server-only";

import { requireAuthenticatedAccount } from "@/lib/auth/session";
import type { MembershipRole } from "@/lib/auth/types";
import type { CoachApplicationStatus } from "@/lib/coachProfileApplication/constants";
import { loadBookingAttention } from "@/lib/queries/coachBookings";
import { createClient } from "@/lib/supabase/server";
import type { VenueApplicationStatus } from "@/lib/venueProfileApplication/constants";

type ProfileRow = {
  full_name: string | null;
};

type CoachSummary = {
  id: string;
  name: string | null;
  slug: string | null;
};

type VenueSummary = {
  id: string;
  name: string | null;
  city: string | null;
  country: string | null;
};

type CoachMembershipRow = {
  coach_id: string;
  membership_role: MembershipRole;
  coaches: CoachSummary | CoachSummary[] | null;
};

type VenueMembershipRow = {
  venue_id: string;
  membership_role: MembershipRole;
  venues: VenueSummary | VenueSummary[] | null;
};

export type ManagedCoach = {
  id: string;
  name: string;
  slug: string | null;
  membershipRole: MembershipRole;
};

export type ManagedVenue = {
  id: string;
  name: string;
  location: string;
  membershipRole: MembershipRole;
};

export type AccountCoachApplicationSummary = {
  id: string;
  status: CoachApplicationStatus;
  currentStep: number;
  submittedAt: string | null;
  updatedAt: string;
  reviewNote: string | null;
  coachId: string | null;
} | null;

export type AccountVenueApplicationSummary = {
  id: string;
  status: VenueApplicationStatus;
  currentStep: number;
  submittedAt: string | null;
  updatedAt: string;
  reviewNote: string | null;
  approvedVenueId: string | null;
} | null;

export type AccountRelationshipAttention = {
  venueInvitations: number;
  coachRequests: number;
  items: Array<{
    kind: "coach" | "venue";
    entityId: string;
    entityName: string;
    count: number;
    href: string;
    message: string;
  }>;
};

export type AccountBookingAttention = {
  playerAwaiting: number;
  playerAcceptedUpcoming: number;
  coachNewRequests: Array<{ coachId: string; coachName: string; count: number }>;
  coachAcceptedUpcoming: Array<{
    coachId: string;
    coachName: string;
    count: number;
  }>;
};

export type AccountDashboardData = {
  account: {
    id: string;
    email: string;
    fullName: string | null;
  };
  coaches: ManagedCoach[];
  venues: ManagedVenue[];
  coachApplication: AccountCoachApplicationSummary;
  venueApplication: AccountVenueApplicationSummary;
  relationshipAttention: AccountRelationshipAttention;
  bookingAttention: AccountBookingAttention;
};

function one<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export async function loadAccountDashboard(): Promise<AccountDashboardData> {
  const account = await requireAuthenticatedAccount("/account");
  const supabase = await createClient();

  const [
    profileResult,
    coachResult,
    venueResult,
    coachApplicationResult,
    venueApplicationResult,
  ] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", account.id)
        .maybeSingle(),
      supabase
        .from("coach_memberships")
        .select(
          `
        coach_id,
        membership_role,
        coaches (
          id,
          name,
          slug
        )
      `
        )
        .eq("user_id", account.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("venue_memberships")
        .select(
          `
        venue_id,
        membership_role,
        venues (
          id,
          name,
          city,
          country
        )
      `
        )
        .eq("user_id", account.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("coach_profile_applications")
        .select(
          "id, status, current_step, submitted_at, updated_at, review_note, coach_id"
        )
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
        .maybeSingle(),
      supabase
        .from("venue_profile_applications")
        .select(
          "id, status, current_step, submitted_at, updated_at, review_note, approved_venue_id"
        )
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
        .maybeSingle(),
    ]);

  if (profileResult.error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[account] profile:", profileResult.error.message);
    }
    throw new Error("Unable to load account profile.");
  }
  if (coachResult.error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[account] coach memberships:", coachResult.error.message);
    }
    throw new Error("Unable to load coach memberships.");
  }
  if (venueResult.error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[account] venue memberships:", venueResult.error.message);
    }
    throw new Error("Unable to load venue memberships.");
  }
  if (coachApplicationResult.error) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[account] coach application:",
        coachApplicationResult.error.message
      );
    }
    throw new Error("Unable to load coach application.");
  }
  if (venueApplicationResult.error) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[account] venue application:",
        venueApplicationResult.error.message
      );
    }
    throw new Error("Unable to load venue application.");
  }

  const profile = profileResult.data as ProfileRow | null;
  const coachMemberships = (coachResult.data ?? []) as unknown as CoachMembershipRow[];
  const venueMemberships = (venueResult.data ?? []) as unknown as VenueMembershipRow[];

  const coaches = coachMemberships.map((membership) => {
    const coach = one(membership.coaches);
    return {
      id: coach?.id ?? membership.coach_id,
      name: coach?.name?.trim() || "Coach profile",
      slug: coach?.slug?.trim() || null,
      membershipRole: membership.membership_role,
    };
  });

  const venues = venueMemberships.map((membership) => {
    const venue = one(membership.venues);
    return {
      id: venue?.id ?? membership.venue_id,
      name: venue?.name?.trim() || "Venue",
      location: [venue?.city, venue?.country]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(", "),
      membershipRole: membership.membership_role,
    };
  });

  const coachApplicationRow = coachApplicationResult.data as {
    id: string;
    status: CoachApplicationStatus;
    current_step: number;
    submitted_at: string | null;
    updated_at: string;
    review_note: string | null;
    coach_id: string | null;
  } | null;
  const venueApplicationRow = venueApplicationResult.data as {
    id: string;
    status: VenueApplicationStatus;
    current_step: number;
    submitted_at: string | null;
    updated_at: string;
    review_note: string | null;
    approved_venue_id: string | null;
  } | null;

  const coachIds = coaches.map((coach) => coach.id);
  const venueIds = venues.map((venue) => venue.id);
  const relationshipAttention: AccountRelationshipAttention = {
    venueInvitations: 0,
    coachRequests: 0,
    items: [],
  };

  if (coachIds.length > 0 || venueIds.length > 0) {
    const [coachPendingResult, venuePendingResult] = await Promise.all([
      coachIds.length > 0
        ? supabase
            .from("coach_venues")
            .select("id, coach_id")
            .in("coach_id", coachIds)
            .eq("status", "pending")
            .eq("initiated_by", "venue")
        : Promise.resolve({ data: [], error: null }),
      venueIds.length > 0
        ? supabase
            .from("coach_venues")
            .select("id, venue_id")
            .in("venue_id", venueIds)
            .eq("status", "pending")
            .eq("initiated_by", "coach")
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (coachPendingResult.error) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "[account] venue invitations:",
          coachPendingResult.error.message
        );
      }
      throw new Error("Unable to load venue invitations.");
    }
    if (venuePendingResult.error) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "[account] coach requests:",
          venuePendingResult.error.message
        );
      }
      throw new Error("Unable to load coach requests.");
    }

    const invitationsByCoach = new Map<string, number>();
    for (const row of coachPendingResult.data ?? []) {
      const id = String(row.coach_id);
      invitationsByCoach.set(id, (invitationsByCoach.get(id) ?? 0) + 1);
    }
    const requestsByVenue = new Map<string, number>();
    for (const row of venuePendingResult.data ?? []) {
      const id = String(row.venue_id);
      requestsByVenue.set(id, (requestsByVenue.get(id) ?? 0) + 1);
    }

    for (const coach of coaches) {
      const count = invitationsByCoach.get(coach.id) ?? 0;
      if (count <= 0) continue;
      relationshipAttention.venueInvitations += count;
      relationshipAttention.items.push({
        kind: "coach",
        entityId: coach.id,
        entityName: coach.name,
        count,
        href: `/account/coaches/${encodeURIComponent(coach.id)}/venues`,
        message:
          count === 1
            ? "1 venue invitation awaiting your response"
            : `${count} venue invitations awaiting your response`,
      });
    }

    for (const venue of venues) {
      const count = requestsByVenue.get(venue.id) ?? 0;
      if (count <= 0) continue;
      relationshipAttention.coachRequests += count;
      relationshipAttention.items.push({
        kind: "venue",
        entityId: venue.id,
        entityName: venue.name,
        count,
        href: `/account/venues/${encodeURIComponent(venue.id)}/coaches`,
        message:
          count === 1
            ? "1 coach request awaiting venue review"
            : `${count} coach requests awaiting venue review`,
      });
    }
  }

  const bookingAttention = await loadBookingAttention(account.id);

  return {
    account: {
      id: account.id,
      email: account.email,
      fullName: profile?.full_name?.trim() || null,
    },
    coaches,
    venues,
    coachApplication: coachApplicationRow
      ? {
          id: coachApplicationRow.id,
          status: coachApplicationRow.status,
          currentStep: coachApplicationRow.current_step,
          submittedAt: coachApplicationRow.submitted_at,
          updatedAt: coachApplicationRow.updated_at,
          reviewNote: coachApplicationRow.review_note,
          coachId: coachApplicationRow.coach_id,
        }
      : null,
    venueApplication: venueApplicationRow
      ? {
          id: venueApplicationRow.id,
          status: venueApplicationRow.status,
          currentStep: venueApplicationRow.current_step,
          submittedAt: venueApplicationRow.submitted_at,
          updatedAt: venueApplicationRow.updated_at,
          reviewNote: venueApplicationRow.review_note,
          approvedVenueId: venueApplicationRow.approved_venue_id,
        }
      : null,
    relationshipAttention,
    bookingAttention,
  };
}
