import { isValidInvitationRawToken } from "@/lib/admin/invitationToken";

export const ADMIN_INVITATION_COOKIE = "pp_admin_invitation";
export const ADMIN_INVITATION_COOKIE_PATH = "/admin/invitations";
export const ADMIN_INVITATION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24;

export type InvitationCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
};

export function adminInvitationCookieOptions(
  nodeEnv: string | undefined = process.env.NODE_ENV
): InvitationCookieOptions {
  return {
    httpOnly: true,
    secure: nodeEnv === "production",
    sameSite: "lax",
    path: ADMIN_INVITATION_COOKIE_PATH,
    maxAge: ADMIN_INVITATION_COOKIE_MAX_AGE_SECONDS,
  };
}

export function describeAdminInvitationCookieConfig(
  nodeEnv: string | undefined = process.env.NODE_ENV
) {
  const options = adminInvitationCookieOptions(nodeEnv);
  return {
    name: ADMIN_INVITATION_COOKIE,
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
    path: options.path,
    maxAge: options.maxAge,
  };
}

export function sanitizeInvitationTokenForCookie(
  rawToken: string
): string | null {
  const trimmed = rawToken.trim();
  if (!isValidInvitationRawToken(trimmed)) return null;
  return trimmed;
}
