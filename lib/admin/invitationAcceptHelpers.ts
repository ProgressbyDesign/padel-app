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

/** Map RPC errors without exposing PostgreSQL text to the invitee. */
export function mapAcceptAdminInvitationError(message: string): string {
  const msg = message.toLowerCase();
  if (msg.includes("this invitation has expired")) {
    return "This invitation has expired.";
  }
  if (msg.includes("was cancelled") || msg.includes("was canceled")) {
    return "This invitation was cancelled.";
  }
  if (
    msg.includes("this invitation belongs to another account") ||
    msg.includes("cannot be accepted by the current account")
  ) {
    return "This invitation cannot be used with the current account.";
  }
  return "We couldn't accept this invitation. Please try again or ask an Owner to resend it.";
}
