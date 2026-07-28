"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAdminAuditEvent } from "@/lib/admin/audit";
import { ADMIN_INVITATION_ACCEPT_PATH as ACCEPT_PATH } from "@/lib/admin/invitationAcceptHelpers";
import {
  clearAdminInvitationTokenCookie,
  readAdminInvitationTokenFromCookie,
  setAdminInvitationTokenCookie,
} from "@/lib/admin/invitationCookie";
import {
  hashInvitationToken,
  hasMeaningfulFullName,
  isValidInvitationRawToken,
  normalizeInvitationEmail,
} from "@/lib/admin/invitationToken";
import {
  isAdminRole,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type AdminRole,
} from "@/lib/admin/permissions";
import { authCallbackUrl } from "@/lib/auth/redirects";
import { trustedAuthCallbackUrl } from "@/lib/auth/trustedOrigin";
import { createClient } from "@/lib/supabase/server";

export type AcceptInvitationResult = {
  ok: boolean;
  message: string;
};

export type InvitationMagicLinkResult = {
  ok: boolean;
  message: string;
};

export type InvitationPreview = {
  status:
    | "pending"
    | "accepted"
    | "cancelled"
    | "expired"
    | "unavailable"
    | "missing-cookie"
    | "invalid-token";
  role?: AdminRole;
  roleLabel?: string;
  roleDescription?: string;
  expiresAt?: string;
  hasActiveMembership?: boolean;
};

const MAX_EMAIL_LENGTH = 254;

export async function storeInvitationTokenFromLegacyUrlAction(
  formData: FormData
): Promise<void> {
  const raw = formData.get("token");
  const token = typeof raw === "string" ? raw : "";
  await setAdminInvitationTokenCookie(token);
  redirect(ACCEPT_PATH);
}

export async function sendAdminInvitationMagicLink(
  emailInput: string
): Promise<InvitationMagicLinkResult> {
  const email = normalizeInvitationEmail(emailInput);
  if (!email || email.length > MAX_EMAIL_LENGTH) {
    return { ok: false, message: "Enter a valid email address." };
  }

  const token = await readAdminInvitationTokenFromCookie();
  if (!token) {
    return {
      ok: false,
      message:
        "This invitation session expired. Open the invitation link from your email again.",
    };
  }

  const emailRedirectTo =
    trustedAuthCallbackUrl(ACCEPT_PATH) ?? (await authCallbackUrl(ACCEPT_PATH));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo,
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    const code = (error.code ?? "").toLowerCase();
    if (
      code.includes("rate") ||
      msg.includes("rate") ||
      msg.includes("too many")
    ) {
      return {
        ok: false,
        message: "Too many attempts. Please wait a moment and try again.",
      };
    }
    // Generic response — do not reveal account or invitation match state.
    return {
      ok: true,
      message:
        "Check your email. We sent a secure sign-in link. Open it to continue your Admin invitation.",
    };
  }

  return {
    ok: true,
    message:
      "Check your email. We sent a secure sign-in link. Open it to continue your Admin invitation.",
  };
}

export async function switchAdminInvitationAccountAction(): Promise<void> {
  const supabase = await createClient();
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch (error) {
    console.warn(
      "[admin-invitation] switch account signOut failed:",
      error instanceof Error ? error.message : error
    );
  }
  // Intentionally preserve pp_admin_invitation cookie.
  revalidatePath("/", "layout");
  redirect(ACCEPT_PATH);
}

export async function acceptAdminInvitationAction(): Promise<AcceptInvitationResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = claims?.sub;
  if (error || typeof userId !== "string" || !userId) {
    return { ok: false, message: "Sign in to accept this invitation." };
  }

  const rawToken = await readAdminInvitationTokenFromCookie();
  if (!rawToken || !isValidInvitationRawToken(rawToken)) {
    return {
      ok: false,
      message:
        "This invitation session expired. Open the invitation link from your email again.",
    };
  }

  const digest = hashInvitationToken(rawToken);
  const { data: role, error: rpcError } = await supabase.rpc(
    "accept_admin_invitation",
    { invitation_token_digest: digest }
  );

  if (rpcError) {
    // Preserve cookie so the user can switch account or retry.
    const msg = rpcError.message.toLowerCase();
    if (msg.includes("another account") || msg.includes("belongs")) {
      return {
        ok: false,
        message: "This invitation cannot be used with the current account.",
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
      message: "This invitation cannot be used with the current account.",
    };
  }

  if (typeof role !== "string" || !isAdminRole(role)) {
    return {
      ok: false,
      message: "Invitation acceptance could not be verified. Please try again.",
    };
  }

  await writeAdminAuditEvent({
    action: "admin.invitation.accepted",
    targetType: "admin_membership",
    targetId: userId,
    details: { role },
  });

  const { data: membership } = await supabase
    .from("admin_memberships")
    .select("status")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) {
    return {
      ok: false,
      message: "Invitation acceptance could not be verified. Please try again.",
    };
  }

  await clearAdminInvitationTokenCookie();

  await supabase
    .from("profiles")
    .update({
      last_workspace_type: "admin",
      last_workspace_entity_id: null,
    })
    .eq("id", userId);

  revalidatePath("/admin");
  revalidatePath("/admin/team");
  revalidatePath("/admin/audit");
  revalidatePath("/admin/welcome");
  revalidatePath("/account");
  revalidatePath("/account/personal");
  revalidatePath("/account/settings");
  revalidatePath("/", "layout");

  const profile = await loadProfileWithRetry(supabase, userId);
  const email = typeof claims.email === "string" ? claims.email : "";
  if (!hasMeaningfulFullName(profile?.full_name, email)) {
    redirect("/admin/welcome");
  }

  redirect("/admin");
}

export async function loadInvitationPreviewFromCookie(): Promise<InvitationPreview> {
  const rawToken = await readAdminInvitationTokenFromCookie();
  if (!rawToken) {
    return { status: "missing-cookie" };
  }
  if (!isValidInvitationRawToken(rawToken)) {
    return { status: "invalid-token" };
  }

  const digest = hashInvitationToken(rawToken);
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId =
    typeof claimsData?.claims?.sub === "string"
      ? claimsData.claims.sub
      : null;

  const { data, error } = await supabase
    .from("admin_invitations")
    .select("id, email, role, status, expires_at, accepted_at, cancelled_at")
    .eq("token_digest", digest)
    .maybeSingle();

  if (error || !data) {
    // RLS hides non-matching invitations — do not reveal invited email.
    return { status: "unavailable" };
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

  const role = isAdminRole(String(data.role))
    ? (data.role as AdminRole)
    : undefined;

  let hasActiveMembership = false;
  if (userId) {
    const { data: membership } = await supabase
      .from("admin_memberships")
      .select("status")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    hasActiveMembership = Boolean(membership);
  }

  return {
    status,
    role,
    roleLabel: role ? ROLE_LABELS[role] : undefined,
    roleDescription: role ? ROLE_DESCRIPTIONS[role] : undefined,
    expiresAt: String(data.expires_at),
    hasActiveMembership,
  };
}

async function loadProfileWithRetry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<{ full_name: string | null } | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    if (data) return data;
    await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
  }

  // Last resort: ensure a profile row exists for this authenticated user via RLS.
  await supabase.from("profiles").upsert({ id: userId }, { onConflict: "id" });
  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  return data;
}
