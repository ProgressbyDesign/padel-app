import "server-only";

import { accountAvatarDisplayUrl } from "@/lib/accountAvatar";
import { getAdminAccount } from "@/lib/auth/adminSession";
import {
  isWorkspaceType,
  type WorkspaceCoach,
  type WorkspaceVenue,
} from "@/lib/workspace/types";
import { createClient } from "@/lib/supabase/server";
import type { AccountNavContext } from "@/lib/workspace/destination";

export type { AccountNavContext } from "@/lib/workspace/destination";
export {
  resolveWorkspaceDestination,
  isPreferenceAccessible,
} from "@/lib/workspace/destination";

export async function loadOptionalAccountNavContext(): Promise<AccountNavContext | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string" || !userId) return null;

  const email = typeof data?.claims?.email === "string" ? data.claims.email : "";

  const [profileResult, coachResult, venueResult, admin] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "full_name, avatar_path, avatar_updated_at, last_workspace_type, last_workspace_entity_id, role"
      )
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("coach_memberships")
      .select("coach_id, coaches ( id, name )")
      .eq("user_id", userId),
    supabase
      .from("venue_memberships")
      .select("venue_id, venues ( id, name )")
      .eq("user_id", userId),
    getAdminAccount(),
  ]);

  const coaches: WorkspaceCoach[] = [];
  for (const row of coachResult.data ?? []) {
    const coach = row.coaches as { id?: string; name?: string | null } | null;
    const id = String(row.coach_id ?? coach?.id ?? "");
    if (!id) continue;
    coaches.push({
      id,
      name: coach?.name?.trim() || "Coach profile",
    });
  }

  const venues: WorkspaceVenue[] = [];
  for (const row of venueResult.data ?? []) {
    const venue = row.venues as { id?: string; name?: string | null } | null;
    const id = String(row.venue_id ?? venue?.id ?? "");
    if (!id) continue;
    venues.push({
      id,
      name: venue?.name?.trim() || "Venue profile",
    });
  }

  const profile = profileResult.data;
  const preferenceType = isWorkspaceType(profile?.last_workspace_type)
    ? profile.last_workspace_type
    : null;
  const avatarPath =
    typeof profile?.avatar_path === "string" && profile.avatar_path.trim()
      ? profile.avatar_path.trim()
      : null;
  const avatarUpdatedAt =
    typeof profile?.avatar_updated_at === "string"
      ? profile.avatar_updated_at
      : null;

  return {
    id: userId,
    email,
    fullName:
      typeof profile?.full_name === "string"
        ? profile.full_name.trim() || null
        : null,
    avatarPath,
    avatarUpdatedAt,
    avatarUrl: accountAvatarDisplayUrl(avatarPath, avatarUpdatedAt),
    coaches,
    venues,
    isAdmin: Boolean(admin) || profile?.role === "admin",
    preference: {
      type: preferenceType,
      entityId:
        typeof profile?.last_workspace_entity_id === "string"
          ? profile.last_workspace_entity_id
          : null,
    },
  };
}
