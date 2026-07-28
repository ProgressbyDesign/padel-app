import { isValidInvitationRawToken } from "@/lib/admin/invitationToken";
import { safeInternalPath } from "@/lib/auth/safePath";

const ACCEPT_PATH = "/admin/invitations/accept";

function firstParam(value: string | string[] | undefined): string | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function parseInvitationTokenSearchParam(
  value: string | string[] | undefined
): string | null {
  const token = firstParam(value)?.trim() ?? "";
  if (!token || !isValidInvitationRawToken(token)) return null;
  return token;
}

export function invitationPasswordLoginHref(): string {
  return `/login?next=${encodeURIComponent(safeInternalPath(ACCEPT_PATH))}`;
}

export { ACCEPT_PATH as ADMIN_INVITATION_ACCEPT_PATH };
