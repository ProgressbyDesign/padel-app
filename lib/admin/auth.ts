import { cookies } from "next/headers";

export const ADMIN_COOKIE = "pp_admin_token";

/**
 * Shared-secret gate for legacy /admin/data-quality tools only.
 * Operational admin uses profiles.role = "admin" via Supabase Auth.
 */
export function getAdminSecret(): string | null {
  return process.env.ADMIN_SECRET?.trim() || null;
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const secret = getAdminSecret();
  if (!secret) return false;
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value === secret;
}

export function adminAuthConfigured(): boolean {
  return Boolean(getAdminSecret());
}
