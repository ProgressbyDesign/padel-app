import {
  workspaceHref,
  type WorkspaceCoach,
  type WorkspacePreference,
  type WorkspaceType,
  type WorkspaceVenue,
} from "@/lib/workspace/types";
import type { AdminRole } from "@/lib/admin/permissions";

export type AccountNavContext = {
  id: string;
  email: string;
  fullName: string | null;
  avatarPath: string | null;
  avatarUpdatedAt: string | null;
  avatarUrl: string | null;
  coaches: WorkspaceCoach[];
  venues: WorkspaceVenue[];
  isAdmin: boolean;
  adminRole?: AdminRole | null;
  preference: WorkspacePreference;
};

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
    return workspaceHref("coach", coaches[0]!.id);
  }
  if (venues.length === 1 && coaches.length === 0) {
    return workspaceHref("venue", venues[0]!.id);
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
