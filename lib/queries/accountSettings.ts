import "server-only";

import {
  accountAvatarDisplayUrl,
  accountAvatarPublicUrl,
} from "@/lib/accountAvatar";
import {
  isActiveOpenDeletionStatus,
  type AccountDeletionRequest,
  type DeletionResponsibilitySummary,
} from "@/lib/accountDeletion/types";
import { getAdminAccount } from "@/lib/auth/adminSession";
import { requireAuthenticatedAccount } from "@/lib/auth/session";
import type { MembershipRole } from "@/lib/auth/types";
import {
  loadDeletionResponsibilitySummary,
  loadOwnDeletionRequest,
} from "@/lib/queries/accountDeletionRequests";
import { createClient } from "@/lib/supabase/server";

export type AccountSettingsMembership = {
  id: string;
  name: string;
  membershipRole: MembershipRole;
};

export type AccountSettingsPageData = {
  account: {
    id: string;
    email: string;
    fullName: string | null;
    avatarPath: string | null;
    avatarUpdatedAt: string | null;
    avatarUrl: string | null;
  };
  coaches: AccountSettingsMembership[];
  venues: AccountSettingsMembership[];
  isAdmin: boolean;
  deletionRequest: AccountDeletionRequest | null;
  openDeletionRequest: AccountDeletionRequest | null;
  latestDeletionStatus: string | null;
  responsibility: DeletionResponsibilitySummary;
};

export type AccountAvatarNavFields = {
  avatarPath: string | null;
  avatarUpdatedAt: string | null;
  avatarPublicUrl: string | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function loadAccountAvatarForNav(
  userId: string
): Promise<AccountAvatarNavFields> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("avatar_path, avatar_updated_at")
    .eq("id", userId)
    .maybeSingle();

  const avatarPath =
    typeof data?.avatar_path === "string" && data.avatar_path.trim()
      ? data.avatar_path.trim()
      : null;
  const avatarUpdatedAt =
    typeof data?.avatar_updated_at === "string"
      ? data.avatar_updated_at
      : null;

  return {
    avatarPath,
    avatarUpdatedAt,
    avatarPublicUrl: avatarPath
      ? accountAvatarDisplayUrl(avatarPath, avatarUpdatedAt) ??
        accountAvatarPublicUrl(supabase, avatarPath)
      : null,
  };
}

export async function loadAccountSettingsPage(): Promise<AccountSettingsPageData> {
  const account = await requireAuthenticatedAccount("/account/settings");
  const supabase = await createClient();

  const [
    profileResult,
    coachResult,
    venueResult,
    admin,
    deletionRequest,
    responsibility,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, avatar_path, avatar_updated_at, role")
      .eq("id", account.id)
      .maybeSingle(),
    supabase
      .from("coach_memberships")
      .select("coach_id, membership_role, coaches ( id, name )")
      .eq("user_id", account.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("venue_memberships")
      .select("venue_id, membership_role, venues ( id, name )")
      .eq("user_id", account.id)
      .order("created_at", { ascending: true }),
    getAdminAccount(),
    loadOwnDeletionRequest(account.id),
    loadDeletionResponsibilitySummary(account.id),
  ]);

  if (profileResult.error) {
    throw new Error("Unable to load account profile.");
  }
  if (coachResult.error) {
    throw new Error("Unable to load coach memberships.");
  }
  if (venueResult.error) {
    throw new Error("Unable to load venue memberships.");
  }

  const coaches: AccountSettingsMembership[] = [];
  for (const row of coachResult.data ?? []) {
    const coach = one(
      row.coaches as { id?: string; name?: string | null } | null
    );
    const id = String(row.coach_id ?? coach?.id ?? "");
    if (!id) continue;
    coaches.push({
      id,
      name: coach?.name?.trim() || "Coach profile",
      membershipRole: row.membership_role as MembershipRole,
    });
  }

  const venues: AccountSettingsMembership[] = [];
  for (const row of venueResult.data ?? []) {
    const venue = one(
      row.venues as { id?: string; name?: string | null } | null
    );
    const id = String(row.venue_id ?? venue?.id ?? "");
    if (!id) continue;
    venues.push({
      id,
      name: venue?.name?.trim() || "Venue profile",
      membershipRole: row.membership_role as MembershipRole,
    });
  }

  const profile = profileResult.data;
  const avatarPath =
    typeof profile?.avatar_path === "string" && profile.avatar_path.trim()
      ? profile.avatar_path.trim()
      : null;
  const avatarUpdatedAt =
    typeof profile?.avatar_updated_at === "string"
      ? profile.avatar_updated_at
      : null;

  const openDeletionRequest =
    deletionRequest && isActiveOpenDeletionStatus(deletionRequest.status)
      ? deletionRequest
      : null;

  return {
    account: {
      id: account.id,
      email: account.email,
      fullName:
        typeof profile?.full_name === "string"
          ? profile.full_name.trim() || null
          : null,
      avatarPath,
      avatarUpdatedAt,
      avatarUrl: avatarPath
        ? accountAvatarDisplayUrl(avatarPath, avatarUpdatedAt) ??
          accountAvatarPublicUrl(supabase, avatarPath)
        : null,
    },
    coaches,
    venues,
    isAdmin: Boolean(admin),
    deletionRequest,
    openDeletionRequest,
    latestDeletionStatus: deletionRequest?.status ?? null,
    responsibility,
  };
}
