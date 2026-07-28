import "server-only";

import { getCurrentAdminMembership } from "@/lib/auth/adminSession";
import { createClient } from "@/lib/supabase/server";

export const ADMIN_AUDIT_ACTIONS = [
  "admin.invitation.created",
  "admin.invitation.cancelled",
  "admin.invitation.resent",
  "admin.invitation.accepted",
  "admin.membership.role_changed",
  "admin.membership.suspended",
  "admin.membership.reactivated",
  "admin.membership.revoked",
  "coach_application.approved",
  "coach_application.declined",
  "coach_application.changes_requested",
  "venue_application.approved",
  "venue_application.declined",
  "venue_application.changes_requested",
  "relationship.created",
  "relationship.activated",
  "relationship.ended",
  "booking.admin_cancelled",
  "account_deletion.processing",
  "account_deletion.declined",
  "profile.admin_updated",
] as const;

export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number];

export const AUDIT_ACTION_LABELS: Record<AdminAuditAction, string> = {
  "admin.invitation.created": "Invitation created",
  "admin.invitation.cancelled": "Invitation cancelled",
  "admin.invitation.resent": "Invitation resent",
  "admin.invitation.accepted": "Invitation accepted",
  "admin.membership.role_changed": "Team role changed",
  "admin.membership.suspended": "Team member suspended",
  "admin.membership.reactivated": "Team member reactivated",
  "admin.membership.revoked": "Team member revoked",
  "coach_application.approved": "Coach application approved",
  "coach_application.declined": "Coach application declined",
  "coach_application.changes_requested": "Coach application changes requested",
  "venue_application.approved": "Venue application approved",
  "venue_application.declined": "Venue application declined",
  "venue_application.changes_requested": "Venue application changes requested",
  "relationship.created": "Relationship created",
  "relationship.activated": "Relationship activated",
  "relationship.ended": "Relationship ended",
  "booking.admin_cancelled": "Booking cancelled by admin",
  "account_deletion.processing": "Account deletion marked processing",
  "account_deletion.declined": "Account deletion declined",
  "profile.admin_updated": "Profile updated by admin",
};

const SECRET_DETAIL_KEYS = new Set([
  "password",
  "token",
  "rawToken",
  "raw_token",
  "tokenDigest",
  "token_digest",
  "access_token",
  "refresh_token",
  "session",
  "cookie",
  "authorization",
  "message",
  "player_message",
  "requester_message",
]);

export function sanitizeAuditDetails(
  details: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!details) return {};
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (SECRET_DETAIL_KEYS.has(key)) continue;
    if (/token|password|secret|digest/i.test(key)) continue;
    if (typeof value === "string" && value.length > 500) {
      clean[key] = `${value.slice(0, 500)}…`;
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

export async function writeAdminAuditEvent(input: {
  action: AdminAuditAction;
  targetType: string;
  targetId?: string | null;
  details?: Record<string, unknown> | null;
}): Promise<{ ok: boolean; message?: string }> {
  const membership = await getCurrentAdminMembership();
  if (!membership) {
    return { ok: false, message: "No active admin membership for audit." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("admin_audit_log").insert({
    actor_user_id: membership.userId,
    actor_role: membership.role,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    details: sanitizeAuditDetails(input.details),
  });

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[admin-audit] insert failed:", error.message);
    }
    return { ok: false, message: "Unable to write audit event." };
  }
  return { ok: true };
}

export function humanizeAuditAction(action: string): string {
  if (action in AUDIT_ACTION_LABELS) {
    return AUDIT_ACTION_LABELS[action as AdminAuditAction];
  }
  return action.replaceAll(".", " · ");
}
