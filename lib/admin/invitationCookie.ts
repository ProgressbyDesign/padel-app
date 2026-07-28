import "server-only";

import { cookies } from "next/headers";
import {
  ADMIN_INVITATION_COOKIE,
  adminInvitationCookieOptions,
  sanitizeInvitationTokenForCookie,
} from "@/lib/admin/invitationCookieConfig";

export {
  ADMIN_INVITATION_COOKIE,
  ADMIN_INVITATION_COOKIE_PATH,
  ADMIN_INVITATION_COOKIE_MAX_AGE_SECONDS,
  adminInvitationCookieOptions,
  describeAdminInvitationCookieConfig,
} from "@/lib/admin/invitationCookieConfig";

export async function readAdminInvitationTokenFromCookie(): Promise<string | null> {
  const jar = await cookies();
  return sanitizeInvitationTokenForCookie(
    jar.get(ADMIN_INVITATION_COOKIE)?.value ?? ""
  );
}

export async function setAdminInvitationTokenCookie(
  rawToken: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const sanitized = sanitizeInvitationTokenForCookie(rawToken);
  if (!sanitized) {
    return { ok: false, message: "This invitation link is invalid." };
  }
  const jar = await cookies();
  jar.set(ADMIN_INVITATION_COOKIE, sanitized, adminInvitationCookieOptions());
  return { ok: true };
}

export async function clearAdminInvitationTokenCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_INVITATION_COOKIE, "", {
    ...adminInvitationCookieOptions(),
    maxAge: 0,
  });
}
