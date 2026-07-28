import { NextResponse } from "next/server";
import { isValidInvitationRawToken } from "@/lib/admin/invitationToken";
import {
  ADMIN_INVITATION_COOKIE,
  adminInvitationCookieOptions,
} from "@/lib/admin/invitationCookieConfig";
import { configuredAppOrigin } from "@/lib/notifications/emailDelivery";

function requestOrigin(request: Request): string {
  const configured = configuredAppOrigin();
  if (configured) return configured;
  return new URL(request.url).origin;
}

/**
 * Stores the raw invitation token in an HTTP-only cookie, then redirects to
 * /admin/invitations/accept without the token in the URL.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const rawToken = requestUrl.searchParams.get("token")?.trim() ?? "";
  const origin = requestOrigin(request);
  const acceptUrl = new URL("/admin/invitations/accept", origin);

  if (!rawToken || !isValidInvitationRawToken(rawToken)) {
    return NextResponse.redirect(acceptUrl);
  }

  const response = NextResponse.redirect(acceptUrl);
  response.cookies.set(
    ADMIN_INVITATION_COOKIE,
    rawToken,
    adminInvitationCookieOptions()
  );
  return response;
}
