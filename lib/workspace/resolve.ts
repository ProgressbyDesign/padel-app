import "server-only";

import { getAdminAccount } from "@/lib/auth/adminSession";
import {
  isWorkspaceType,
  workspaceHref,
  type WorkspaceCoach,
  type WorkspacePreference,
  type WorkspaceType,
  type WorkspaceVenue,
} from "@/lib/workspace/types";
import { createClient } from "@/lib/supabase/server";

export type AccountNavContext = {
  id: string;
  email: string;
  fullName: string | null;
  coaches: WorkspaceCoach[];
  venues: WorkspaceVenue[];
  isAdmin: boolean;
  preference: WorkspacePreference;
};

export async function loadOptionalAccountNavContext(): Promise<AccountNavContext | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string" || !userId) return null;

  const email = typeof data?.claims?.email === "string" ? data.claims.email : "";

  const [profileResult, coachResult, venueResult, admin] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, last_workspace_type, last_workspace_entity_id, role")
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

  return {
    id: userId,
    email,
    fullName:
      typeof profile?.full_name === "string"
        ? profile.full_name.trim() || null
        : null,
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

export function resolveWorkspaceDestination(
  context: AccountNavContext
): string {
  const { preference, coaches, venues, isAdmin } = context;

  if (preference.type === "personal") {
    return workspaceHref("personal");
  }
  if (preference.type === "admin" && isAdmin) {
    return workspaceHref("admin");
  }
  if (preference.type === "coach" && preference.entityId) {
    if (coaches.some((coach) => coach.id === preference.entityId)) {
      return workspaceHref("coach", preference.entityId);
    }
  }
  if (preference.type === "venue" && preference.entityId) {
    if (venues.some((venue) => venue.id === preference.entityId)) {
      return workspaceHref("venue", preference.entityId);
    }
  }

  if (coaches.length === 1 && venues.length === 0) {
    return workspaceHref("coach", coaches[0].id);
  }
  if (venues.length === 1 && coaches.length === 0) {
    return workspaceHref("venue", venues[0].id);
  }

  return workspaceHref("personal");
}

export function isPreferenceAccessible(
  context: AccountNavContext,
  type: WorkspaceType,
  entityId?: string | null
): boolean {
  if (type === "personal") return true;
  if (type === "admin") return context.isAdmin;
  if (type === "coach") {
    return Boolean(entityId && context.coaches.some((c) => c.id === entityId));
  }
  if (type === "venue") {
    return Boolean(entityId && context.venues.some((v) => v.id === entityId));
  }
  return false;
}
