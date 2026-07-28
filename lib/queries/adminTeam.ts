import "server-only";

import {
  isAdminRole,
  ROLE_LABELS,
  type AdminRole,
} from "@/lib/admin/permissions";
import type { InvitationEmailStatus } from "@/lib/notifications/emailDelivery";
import { requireAdminPermission } from "@/lib/auth/adminSession";
import { createClient } from "@/lib/supabase/server";

export type AdminTeamMemberRow = {
  userId: string;
  role: AdminRole;
  status: "active" | "suspended" | "revoked";
  joinedAt: string;
  updatedAt: string;
  invitedByUserId: string | null;
  fullName: string | null;
  email: string | null;
  invitedByName: string | null;
};

export type AdminInvitationRow = {
  id: string;
  email: string;
  role: AdminRole;
  status: "pending" | "accepted" | "cancelled" | "expired";
  invitedByUserId: string;
  acceptedByUserId: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  invitedByName: string | null;
  lastEmailStatus: InvitationEmailStatus | null;
  lastSendAttemptAt: string | null;
  lastSentAt: string | null;
  sendCount: number;
  lastEmailErrorCode: string | null;
};

export async function loadAdminTeamBoard(): Promise<{
  active: AdminTeamMemberRow[];
  suspended: AdminTeamMemberRow[];
  revoked: AdminTeamMemberRow[];
  pendingInvitations: AdminInvitationRow[];
  pastInvitations: AdminInvitationRow[];
}> {
  await requireAdminPermission("team.manage");
  const supabase = await createClient();

  const [{ data: memberships }, { data: invitations }] = await Promise.all([
    supabase
      .from("admin_memberships")
      .select(
        "user_id, role, status, invited_by_user_id, joined_at, updated_at"
      )
      .order("joined_at", { ascending: true }),
    supabase
      .from("admin_invitations")
      .select(
        "id, email, role, status, invited_by_user_id, accepted_by_user_id, expires_at, accepted_at, cancelled_at, created_at, updated_at, last_email_status, last_send_attempt_at, last_sent_at, send_count, last_email_error_code"
      )
      .order("created_at", { ascending: false }),
  ]);

  const userIds = new Set<string>();
  for (const row of memberships ?? []) {
    userIds.add(String(row.user_id));
    if (row.invited_by_user_id) userIds.add(String(row.invited_by_user_id));
  }
  for (const row of invitations ?? []) {
    userIds.add(String(row.invited_by_user_id));
  }

  const ids = [...userIds];
  const profileMap = new Map<string, { full_name: string | null }>();
  if (ids.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);
    for (const p of profiles ?? []) {
      profileMap.set(String(p.id), {
        full_name:
          typeof p.full_name === "string" ? p.full_name.trim() || null : null,
      });
    }
  }

  // Emails: prefer invitation email for members who accepted an invite.
  const emailByUser = new Map<string, string>();
  for (const row of invitations ?? []) {
    if (row.status === "accepted" && row.accepted_by_user_id) {
      emailByUser.set(String(row.accepted_by_user_id), String(row.email));
    }
  }

  const members: AdminTeamMemberRow[] = (memberships ?? [])
    .filter((row) => isAdminRole(String(row.role)))
    .map((row) => {
      const userId = String(row.user_id);
      const invitedBy = row.invited_by_user_id
        ? String(row.invited_by_user_id)
        : null;
      return {
        userId,
        role: row.role as AdminRole,
        status: row.status as AdminTeamMemberRow["status"],
        joinedAt: String(row.joined_at),
        updatedAt: String(row.updated_at),
        invitedByUserId: invitedBy,
        fullName: profileMap.get(userId)?.full_name ?? null,
        email: emailByUser.get(userId) ?? null,
        invitedByName: invitedBy
          ? (profileMap.get(invitedBy)?.full_name ?? null)
          : null,
      };
    });

  const now = Date.now();
  const invitationRows: AdminInvitationRow[] = (invitations ?? [])
    .filter((row) => isAdminRole(String(row.role)))
    .map((row) => {
      let status = String(row.status) as AdminInvitationRow["status"];
      if (
        status === "pending" &&
        new Date(String(row.expires_at)).getTime() <= now
      ) {
        status = "expired";
      }
      const invitedBy = String(row.invited_by_user_id);
      return {
        id: String(row.id),
        email: String(row.email),
        role: row.role as AdminRole,
        status,
        invitedByUserId: invitedBy,
        acceptedByUserId: row.accepted_by_user_id
          ? String(row.accepted_by_user_id)
          : null,
        expiresAt: String(row.expires_at),
        acceptedAt: row.accepted_at ? String(row.accepted_at) : null,
        cancelledAt: row.cancelled_at ? String(row.cancelled_at) : null,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
        invitedByName: profileMap.get(invitedBy)?.full_name ?? null,
        lastEmailStatus: parseInvitationEmailStatus(row.last_email_status),
        lastSendAttemptAt: row.last_send_attempt_at
          ? String(row.last_send_attempt_at)
          : null,
        lastSentAt: row.last_sent_at ? String(row.last_sent_at) : null,
        sendCount:
          typeof row.send_count === "number" && row.send_count >= 0
            ? row.send_count
            : 0,
        lastEmailErrorCode:
          typeof row.last_email_error_code === "string"
            ? row.last_email_error_code
            : null,
      };
    });

  return {
    active: members.filter((m) => m.status === "active"),
    suspended: members.filter((m) => m.status === "suspended"),
    revoked: members.filter((m) => m.status === "revoked"),
    pendingInvitations: invitationRows.filter((i) => i.status === "pending"),
    pastInvitations: invitationRows.filter((i) => i.status !== "pending"),
  };
}

export function roleLabel(role: AdminRole): string {
  return ROLE_LABELS[role];
}

function parseInvitationEmailStatus(
  value: unknown
): InvitationEmailStatus | null {
  if (value === "pending" || value === "sent" || value === "failed") {
    return value;
  }
  return null;
}
