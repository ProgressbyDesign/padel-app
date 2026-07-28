import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import {
  hasAdminPermission,
  isAdminMembershipStatus,
  isAdminRole,
  type AdminMembership,
  type AdminPermission,
  type AdminRole,
  canAccessDataQuality,
} from "@/lib/admin/permissions";
import { accountAvatarDisplayUrl } from "@/lib/accountAvatar";
import { createClient } from "@/lib/supabase/server";

export type AdminAccount = {
  id: string;
  email: string;
  fullName: string | null;
  role: AdminRole;
  status: "active";
  avatarPath: string | null;
  avatarUpdatedAt: string | null;
  avatarUrl: string | null;
};

/**
 * Operational admin gate via public.admin_memberships.
 * Does not use profiles.role, ADMIN_SECRET, or JWT app_metadata.
 */
export const getCurrentAdminMembership = cache(
  async (): Promise<
    | (AdminMembership & {
        email: string;
        fullName: string | null;
        avatarPath: string | null;
        avatarUpdatedAt: string | null;
        avatarUrl: string | null;
      })
    | null
  > => {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;
    const userId = claims?.sub;
    if (error || typeof userId !== "string" || !userId) return null;

    const { data: membership, error: membershipError } = await supabase
      .from("admin_memberships")
      .select("user_id, role, status")
      .eq("user_id", userId)
      .maybeSingle();

    if (membershipError || !membership) return null;
    if (!isAdminRole(String(membership.role))) return null;
    if (!isAdminMembershipStatus(String(membership.status))) return null;
    if (membership.status !== "active") return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, avatar_path, avatar_updated_at")
      .eq("id", userId)
      .maybeSingle();

    const avatarPath =
      typeof profile?.avatar_path === "string" && profile.avatar_path.trim()
        ? profile.avatar_path.trim()
        : null;
    const avatarUpdatedAt =
      typeof profile?.avatar_updated_at === "string"
        ? profile.avatar_updated_at
        : null;

    return {
      userId,
      role: membership.role as AdminRole,
      status: "active",
      email: typeof claims.email === "string" ? claims.email : "",
      fullName:
        typeof profile?.full_name === "string"
          ? profile.full_name.trim() || null
          : null,
      avatarPath,
      avatarUpdatedAt,
      avatarUrl: accountAvatarDisplayUrl(avatarPath, avatarUpdatedAt),
    };
  }
);

/** Active admin membership only — ignores profiles.role entirely. */
export async function getAdminAccount(): Promise<AdminAccount | null> {
  const membership = await getCurrentAdminMembership();
  if (!membership) return null;
  return {
    id: membership.userId,
    email: membership.email,
    fullName: membership.fullName,
    role: membership.role,
    status: "active",
    avatarPath: membership.avatarPath ?? null,
    avatarUpdatedAt: membership.avatarUpdatedAt ?? null,
    avatarUrl: membership.avatarUrl ?? null,
  };
}

export async function requireAdminAccess(
  mode: "redirect" | "not-found" | "access-denied" = "redirect"
): Promise<AdminAccount> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = claims?.sub;

  if (error || typeof userId !== "string" || !userId) {
    if (mode === "not-found") notFound();
    redirect(`/login?next=${encodeURIComponent("/admin")}`);
  }

  const account = await getAdminAccount();
  if (!account) {
    if (mode === "not-found") notFound();
    redirect("/admin/access-denied");
  }
  return account;
}

/** @deprecated Prefer requireAdminAccess — kept as alias for gradual migration. */
export async function requireAdminAccount(
  mode: "redirect" | "not-found" | "access-denied" = "redirect"
): Promise<AdminAccount> {
  return requireAdminAccess(mode);
}

export async function requireAdminPermission(
  permission: AdminPermission,
  mode: "section-denied" | "not-found" | "access-denied" = "section-denied"
): Promise<AdminAccount> {
  const account = await requireAdminAccess(
    mode === "not-found" ? "not-found" : "access-denied"
  );
  if (!hasAdminPermission(account, permission)) {
    if (mode === "not-found") notFound();
    redirect(
      `/admin/section-denied?permission=${encodeURIComponent(permission)}`
    );
  }
  return account;
}

export async function requireDataQualityNavAccess(
  mode: "section-denied" | "not-found" = "section-denied"
): Promise<AdminAccount> {
  const account = await requireAdminAccess("access-denied");
  if (!canAccessDataQuality(account)) {
    if (mode === "not-found") notFound();
    redirect("/admin/section-denied?permission=data-quality");
  }
  return account;
}

export function accountHasPermission(
  account: AdminAccount | null | undefined,
  permission: AdminPermission
): boolean {
  return hasAdminPermission(account ?? null, permission);
}
