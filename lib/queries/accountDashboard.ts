import "server-only";

import { requireAuthenticatedAccount } from "@/lib/auth/session";
import type { MembershipRole } from "@/lib/auth/types";
import type { CoachApplicationStatus } from "@/lib/coachProfileApplication/constants";
import { createClient } from "@/lib/supabase/server";

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

export type AccountApplicationSummary = {
  id: string;
  status: CoachApplicationStatus;
  currentStep: number;
  submittedAt: string | null;
  updatedAt: string;
} | null;

export type AccountDashboardData = {
  account: {
    id: string;
    email: string;
    fullName: string | null;
  };
  coaches: ManagedCoach[];
  venues: ManagedVenue[];
  coachApplication: AccountApplicationSummary;
};

function one<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export async function loadAccountDashboard(): Promise<AccountDashboardData> {
  const account = await requireAuthenticatedAccount("/account");
  const supabase = await createClient();

  const [profileResult, coachResult, venueResult, applicationResult] =
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
        .select("id, status, current_step, submitted_at, updated_at")
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
    throw new Error(`Unable to load account profile: ${profileResult.error.message}`);
  }
  if (coachResult.error) {
    throw new Error(`Unable to load coach memberships: ${coachResult.error.message}`);
  }
  if (venueResult.error) {
    throw new Error(`Unable to load venue memberships: ${venueResult.error.message}`);
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

  const applicationRow = applicationResult.data as {
    id: string;
    status: CoachApplicationStatus;
    current_step: number;
    submitted_at: string | null;
    updated_at: string;
  } | null;

  return {
    account: {
      id: account.id,
      email: account.email,
      fullName: profile?.full_name?.trim() || null,
    },
    coaches,
    venues,
    coachApplication: applicationRow
      ? {
          id: applicationRow.id,
          status: applicationRow.status,
          currentStep: applicationRow.current_step,
          submittedAt: applicationRow.submitted_at,
          updatedAt: applicationRow.updated_at,
        }
      : null,
  };
}
