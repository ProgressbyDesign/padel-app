import { cookies } from "next/headers";

export const ADMIN_COOKIE = "pp_admin_token";

/**
 * Simple shared-secret gate for /admin.
 * TODO: Replace with Supabase Auth + `app_metadata.role = 'admin'` when roles exist.
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
