import { createHash, randomBytes } from "node:crypto";

const MAX_RAW_TOKEN_LENGTH = 256;
const MIN_RAW_TOKEN_BYTES = 32;

export type GeneratedInvitationToken = {
  /** Raw token for the invitation URL — never store or log. */
  rawToken: string;
  /** SHA-256 hex digest stored in admin_invitations.token_digest. */
  tokenDigest: string;
};

export function generateInvitationToken(): GeneratedInvitationToken {
  const rawToken = randomBytes(MIN_RAW_TOKEN_BYTES).toString("base64url");
  return {
    rawToken,
    tokenDigest: hashInvitationToken(rawToken),
  };
}

export function hashInvitationToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function isValidInvitationRawToken(rawToken: string): boolean {
  if (typeof rawToken !== "string") return false;
  const trimmed = rawToken.trim();
  if (!trimmed || trimmed.length > MAX_RAW_TOKEN_LENGTH) return false;
  // base64url alphabet
  return /^[A-Za-z0-9_-]+$/.test(trimmed);
}

export const INVITATION_EXPIRY_OPTIONS_HOURS = [24, 72, 168, 336] as const;
export type InvitationExpiryHours = (typeof INVITATION_EXPIRY_OPTIONS_HOURS)[number];

export function isValidInvitationExpiryHours(
  value: number
): value is InvitationExpiryHours {
  return (INVITATION_EXPIRY_OPTIONS_HOURS as readonly number[]).includes(value);
}

export function invitationExpiresAt(
  hours: InvitationExpiryHours = 168,
  nowMs = Date.now()
): string {
  return new Date(nowMs + hours * 60 * 60 * 1000).toISOString();
}

export function maskEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.indexOf("@");
  if (at <= 0) return "***";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

export function normalizeInvitationEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return null;
  }
  return normalized;
}

/** Build accept URL path with raw token (for email / one-time copy). */
export function invitationAcceptPath(rawToken: string): string {
  return `/admin/invitations/accept?token=${encodeURIComponent(rawToken)}`;
}
