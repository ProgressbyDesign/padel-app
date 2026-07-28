"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAdminAuditEvent } from "@/lib/admin/audit";
import {
  hashInvitationToken,
  isValidInvitationRawToken,
  maskEmail,
} from "@/lib/admin/invitationToken";
import { isAdminRole, type AdminRole } from "@/lib/admin/permissions";
import { createClient } from "@/lib/supabase/server";

export type AcceptInvitationResult = {
  ok: boolean;
  message: string;
};

export async function acceptAdminInvitationAction(
  rawToken: string
): Promise<AcceptInvitationResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = claims?.sub;
  if (error || typeof userId !== "string" || !userId) {
    return { ok: false, message: "Sign in to accept this invitation." };
  }

  if (!isValidInvitationRawToken(rawToken)) {
    return { ok: false, message: "This invitation link is invalid." };
  }

  const digest = hashInvitationToken(rawToken.trim());
  const { data: role, error: rpcError } = await supabase.rpc(
    "accept_admin_invitation",
    { invitation_token_digest: digest }
  );

  if (rpcError) {
    const msg = rpcError.message.toLowerCase();
    if (msg.includes("another account") || msg.includes("belongs")) {
      return {
        ok: false,
        message: "This invitation was sent to a different email address.",
      };
    }
    if (msg.includes("expired")) {
      return { ok: false, message: "This invitation has expired." };
    }
    if (msg.includes("cancelled") || msg.includes("canceled")) {
      return { ok: false, message: "This invitation was cancelled." };
    }
    return {
      ok: false,
      message:
        "This invitation is invalid, expired, or belongs to another account.",
    };
  }

  await writeAdminAuditEvent({
    action: "admin.invitation.accepted",
    targetType: "admin_membership",
    targetId: userId,
    details: { role: typeof role === "string" ? role : null },
  });

  const { data: membership } = await supabase
    .from("admin_memberships")
    .select("status")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (membership) {
    await supabase
      .from("profiles")
      .update({
        last_workspace_type: "admin",
        last_workspace_entity_id: null,
      })
      .eq("id", userId);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/team");
  revalidatePath("/admin/audit");
  revalidatePath("/account");
  revalidatePath("/account/personal");
  revalidatePath("/account/settings");

  redirect("/admin");
}

export async function loadInvitationPreviewByRawToken(rawToken: string): Promise<{
  status: "pending" | "accepted" | "cancelled" | "expired" | "invalid";
  role?: AdminRole;
  emailMasked?: string;
  expiresAt?: string;
  emailMatches?: boolean;
}> {
  if (!isValidInvitationRawToken(rawToken)) {
    return { status: "invalid" };
  }
  const digest = hashInvitationToken(rawToken.trim());
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const callerEmail =
    typeof claimsData?.claims?.email === "string"
      ? claimsData.claims.email.trim().toLowerCase()
      : null;

  const { data, error } = await supabase
    .from("admin_invitations")
    .select("email, role, status, expires_at")
    .eq("token_digest", digest)
    .maybeSingle();

  if (error || !data) {
    return { status: "pending", emailMatches: callerEmail ? true : undefined };
  }

  let status = String(data.status) as
    | "pending"
    | "accepted"
    | "cancelled"
    | "expired";
  if (
    status === "pending" &&
    new Date(String(data.expires_at)).getTime() <= Date.now()
  ) {
    status = "expired";
  }
  const email = String(data.email).toLowerCase();
  const role = isAdminRole(String(data.role))
    ? (data.role as AdminRole)
    : undefined;

  return {
    status,
    role,
    emailMasked: maskEmail(email),
    expiresAt: String(data.expires_at),
    emailMatches: callerEmail ? callerEmail === email : undefined,
  };
}
