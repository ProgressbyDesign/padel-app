"use server";

import { revalidatePath } from "next/cache";
import { writeAdminAuditEvent } from "@/lib/admin/audit";
import {
  generateInvitationToken,
  invitationAcceptPath,
  invitationExpiresAt,
  isValidInvitationExpiryHours,
  maskEmail,
  normalizeInvitationEmail,
  type InvitationExpiryHours,
} from "@/lib/admin/invitationToken";
import {
  canChangeMemberRole,
  canSuspendOrRevokeMember,
  mapOwnerProtectionError,
} from "@/lib/admin/ownerSafety";
import {
  isAdminRole,
  ROLE_LABELS,
  type AdminRole,
} from "@/lib/admin/permissions";
import { requireAdminPermission } from "@/lib/auth/adminSession";
import {
  buildInvitationDeliveryFailureUpdate,
  buildInvitationDeliverySuccessUpdate,
  buildInvitationResendRowUpdate,
} from "@/lib/notifications/emailDelivery";
import { sendAdminInvitationEmail } from "@/lib/notifications/adminTeamEmails";
import { createClient } from "@/lib/supabase/server";

export type TeamActionResult = {
  ok: boolean;
  message: string;
  invitationLink?: string;
  maskedEmail?: string;
  emailSent?: boolean;
};

function revalidateTeamPaths() {
  revalidatePath("/admin/team");
  revalidatePath("/admin");
  revalidatePath("/admin/audit");
}

async function loadMembershipSnapshot() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("admin_memberships")
    .select("user_id, role, status");
  return (data ?? []).map((row) => ({
    userId: String(row.user_id),
    role: row.role as AdminRole,
    status: String(row.status),
  }));
}

async function applyInvitationDeliveryStatus(
  invitationId: string,
  delivery: Awaited<ReturnType<typeof sendAdminInvitationEmail>>
) {
  const supabase = await createClient();
  const patch = delivery.ok
    ? buildInvitationDeliverySuccessUpdate({ providerId: delivery.providerId })
    : buildInvitationDeliveryFailureUpdate({ errorCode: delivery.errorCode });
  await supabase
    .from("admin_invitations")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", invitationId)
    .eq("status", "pending");
}

export async function createAdminInvitationAction(input: {
  email: string;
  role: string;
  expiryHours?: number;
}): Promise<TeamActionResult> {
  const actor = await requireAdminPermission("team.manage", "not-found");
  const email = normalizeInvitationEmail(input.email);
  if (!email) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (!isAdminRole(input.role)) {
    return { ok: false, message: "Choose a valid admin role." };
  }
  const role = input.role as AdminRole;
  const hours: InvitationExpiryHours =
    input.expiryHours != null && isValidInvitationExpiryHours(input.expiryHours)
      ? input.expiryHours
      : 168;

  const { rawToken, tokenDigest } = generateInvitationToken();
  const expiresAt = invitationExpiresAt(hours);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("admin_invitations")
    .insert({
      email,
      role,
      token_digest: tokenDigest,
      status: "pending",
      invited_by_user_id: actor.id,
      expires_at: expiresAt,
      last_email_status: "pending",
    })
    .select("id")
    .maybeSingle();

  if (error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("pending") ||
      msg.includes("unique") ||
      msg.includes("duplicate")
    ) {
      return {
        ok: false,
        message: "A pending invitation already exists for this email.",
      };
    }
    return { ok: false, message: "Unable to create the invitation." };
  }

  const invitationId = data?.id ? String(data.id) : null;
  const acceptPath = invitationAcceptPath(rawToken);

  const delivery = await sendAdminInvitationEmail({
    to: email,
    inviterName: actor.fullName || actor.email || "A Padel Pathways admin",
    role,
    expiresAt,
    acceptPath,
  });

  if (invitationId) {
    await applyInvitationDeliveryStatus(invitationId, delivery);
  }

  await writeAdminAuditEvent({
    action: "admin.invitation.created",
    targetType: "admin_invitation",
    targetId: invitationId,
    details: {
      email: maskEmail(email),
      role,
      expiresAt,
      emailResult: delivery.ok ? "sent" : "failed",
      ...(delivery.ok ? {} : { emailErrorCode: delivery.errorCode }),
    },
  });

  revalidateTeamPaths();

  if (delivery.ok) {
    return {
      ok: true,
      message: `Invitation sent. An invitation was sent to ${maskEmail(email)}.`,
      invitationLink: acceptPath,
      maskedEmail: maskEmail(email),
      emailSent: true,
    };
  }

  return {
    ok: true,
    message: delivery.message,
    invitationLink: acceptPath,
    maskedEmail: maskEmail(email),
    emailSent: false,
  };
}

export async function cancelAdminInvitationAction(
  invitationId: string
): Promise<TeamActionResult> {
  await requireAdminPermission("team.manage", "not-found");
  const supabase = await createClient();
  const { error } = await supabase
    .from("admin_invitations")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitationId)
    .eq("status", "pending");

  if (error) {
    return { ok: false, message: "Unable to cancel this invitation." };
  }

  await writeAdminAuditEvent({
    action: "admin.invitation.cancelled",
    targetType: "admin_invitation",
    targetId: invitationId,
    details: {},
  });
  revalidateTeamPaths();
  return { ok: true, message: "Invitation cancelled." };
}

export async function resendAdminInvitationAction(
  invitationId: string
): Promise<TeamActionResult> {
  const actor = await requireAdminPermission("team.manage", "not-found");
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("admin_invitations")
    .select("id, email, role, status, expires_at")
    .eq("id", invitationId)
    .maybeSingle();

  if (!existing) {
    return { ok: false, message: "Invitation was not found." };
  }
  if (existing.status !== "pending") {
    return {
      ok: false,
      message: "Only pending invitations can be resent.",
    };
  }
  if (new Date(String(existing.expires_at)).getTime() <= Date.now()) {
    return {
      ok: false,
      message: "This invitation has expired. Create a new invitation instead.",
    };
  }

  const role = String(existing.role);
  if (!isAdminRole(role)) {
    return { ok: false, message: "Invalid invitation role." };
  }

  const previousExpiry = String(existing.expires_at);
  const { rawToken, tokenDigest } = generateInvitationToken();
  const expiresAt = invitationExpiresAt(168);
  const tokenPatch = buildInvitationResendRowUpdate({
    tokenDigest,
    expiresAt,
  });

  // Same row: rotate digest + expiry. DB resets delivery fields on token change.
  const { error: updateError } = await supabase
    .from("admin_invitations")
    .update({
      ...tokenPatch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitationId)
    .eq("status", "pending");

  if (updateError) {
    return { ok: false, message: "Unable to rotate the invitation token." };
  }

  const email = String(existing.email);
  const acceptPath = invitationAcceptPath(rawToken);
  const delivery = await sendAdminInvitationEmail({
    to: email,
    inviterName: actor.fullName || actor.email || "A Padel Pathways admin",
    role,
    expiresAt,
    acceptPath,
  });

  await applyInvitationDeliveryStatus(invitationId, delivery);

  await writeAdminAuditEvent({
    action: "admin.invitation.resent",
    targetType: "admin_invitation",
    targetId: invitationId,
    details: {
      email: maskEmail(email),
      role,
      previousExpiry,
      newExpiry: expiresAt,
      emailResult: delivery.ok ? "sent" : "failed",
      ...(delivery.ok ? {} : { emailErrorCode: delivery.errorCode }),
    },
  });

  revalidateTeamPaths();

  if (delivery.ok) {
    return {
      ok: true,
      message: `Invitation resent to ${maskEmail(email)}.`,
      invitationLink: acceptPath,
      maskedEmail: maskEmail(email),
      emailSent: true,
    };
  }

  return {
    ok: true,
    message: delivery.message,
    invitationLink: acceptPath,
    maskedEmail: maskEmail(email),
    emailSent: false,
  };
}

export async function changeAdminMemberRoleAction(input: {
  userId: string;
  newRole: string;
}): Promise<TeamActionResult> {
  await requireAdminPermission("team.manage", "not-found");
  if (!isAdminRole(input.newRole)) {
    return { ok: false, message: "Choose a valid admin role." };
  }
  const members = await loadMembershipSnapshot();
  const safety = canChangeMemberRole({
    members,
    targetUserId: input.userId,
    newRole: input.newRole,
  });
  if (!safety.ok) return { ok: false, message: safety.message };

  const previous = members.find((m) => m.userId === input.userId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("admin_memberships")
    .update({
      role: input.newRole,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", input.userId)
    .eq("status", "active");

  if (error) {
    return { ok: false, message: mapOwnerProtectionError(error.message) };
  }

  const audit = await writeAdminAuditEvent({
    action: "admin.membership.role_changed",
    targetType: "admin_membership",
    targetId: input.userId,
    details: {
      fromRole: previous?.role ?? null,
      toRole: input.newRole,
    },
  });
  if (!audit.ok) {
    return {
      ok: false,
      message:
        "Role may have changed, but the audit event failed. Investigate before continuing.",
    };
  }

  revalidateTeamPaths();
  return {
    ok: true,
    message: `Role updated to ${ROLE_LABELS[input.newRole]}.`,
  };
}

export async function suspendAdminMemberAction(
  userId: string
): Promise<TeamActionResult> {
  await requireAdminPermission("team.manage", "not-found");
  const members = await loadMembershipSnapshot();
  const safety = canSuspendOrRevokeMember({ members, targetUserId: userId });
  if (!safety.ok) return { ok: false, message: safety.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("admin_memberships")
    .update({
      status: "suspended",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) {
    return { ok: false, message: mapOwnerProtectionError(error.message) };
  }

  const audit = await writeAdminAuditEvent({
    action: "admin.membership.suspended",
    targetType: "admin_membership",
    targetId: userId,
    details: {},
  });
  if (!audit.ok) {
    return {
      ok: false,
      message:
        "Member may be suspended, but the audit event failed. Investigate before continuing.",
    };
  }

  revalidateTeamPaths();
  return { ok: true, message: "Team member suspended." };
}

export async function reactivateAdminMemberAction(
  userId: string
): Promise<TeamActionResult> {
  await requireAdminPermission("team.manage", "not-found");
  const supabase = await createClient();
  const { error } = await supabase
    .from("admin_memberships")
    .update({
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("status", "suspended");

  if (error) {
    return { ok: false, message: "Unable to reactivate this team member." };
  }

  const audit = await writeAdminAuditEvent({
    action: "admin.membership.reactivated",
    targetType: "admin_membership",
    targetId: userId,
    details: {},
  });
  if (!audit.ok) {
    return {
      ok: false,
      message:
        "Member may be reactivated, but the audit event failed. Investigate before continuing.",
    };
  }

  revalidateTeamPaths();
  return { ok: true, message: "Team member reactivated." };
}

export async function revokeAdminMemberAction(
  userId: string
): Promise<TeamActionResult> {
  await requireAdminPermission("team.manage", "not-found");
  const members = await loadMembershipSnapshot();
  const safety = canSuspendOrRevokeMember({ members, targetUserId: userId });
  if (!safety.ok) return { ok: false, message: safety.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("admin_memberships")
    .update({
      status: "revoked",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .in("status", ["active", "suspended"]);

  if (error) {
    return { ok: false, message: mapOwnerProtectionError(error.message) };
  }

  const audit = await writeAdminAuditEvent({
    action: "admin.membership.revoked",
    targetType: "admin_membership",
    targetId: userId,
    details: {},
  });
  if (!audit.ok) {
    return {
      ok: false,
      message:
        "Member may be revoked, but the audit event failed. Investigate before continuing.",
    };
  }

  revalidateTeamPaths();
  return { ok: true, message: "Team member access revoked." };
}
