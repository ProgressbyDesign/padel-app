import "server-only";

import {
  configuredAppOrigin,
  invitationEmailStatusLabel,
  type InvitationEmailStatus,
} from "@/lib/notifications/emailDelivery";
import { createClient } from "@/lib/supabase/server";

export type EmailServiceDiagnostic = {
  apiKeyConfigured: boolean;
  senderConfigured: boolean;
  applicationUrlConfigured: boolean;
  senderAddress: string | null;
  applicationOrigin: string | null;
  lastInvitationEmailResult: string;
  lastSafeProviderErrorCode: string | null;
  lastSendAttemptAt: string | null;
};

export function configuredResendApiKey(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function configuredSenderAddress(): string | null {
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.ENQUIRY_FROM_EMAIL?.trim() ||
    "";
  return from || null;
}

export function senderDomainFromAddress(from: string | null | undefined): string | null {
  if (!from) return null;
  const match = from.match(/<([^>]+)>/);
  const email = (match ? match[1] : from).trim();
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase();
}

export function buildEmailServiceDiagnostic(input?: {
  lastEmailStatus?: InvitationEmailStatus | null;
  lastEmailErrorCode?: string | null;
  lastSendAttemptAt?: string | null;
}): EmailServiceDiagnostic {
  const origin = configuredAppOrigin();
  return {
    apiKeyConfigured: configuredResendApiKey(),
    senderConfigured: Boolean(configuredSenderAddress()),
    applicationUrlConfigured: Boolean(origin),
    senderAddress: configuredSenderAddress(),
    applicationOrigin: origin || null,
    lastInvitationEmailResult: invitationEmailStatusLabel(input?.lastEmailStatus),
    lastSafeProviderErrorCode: input?.lastEmailErrorCode ?? null,
    lastSendAttemptAt: input?.lastSendAttemptAt ?? null,
  };
}

export async function loadEmailServiceDiagnostic(): Promise<EmailServiceDiagnostic> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("admin_invitations")
    .select("last_email_status, last_email_error_code, last_send_attempt_at")
    .not("last_send_attempt_at", "is", null)
    .order("last_send_attempt_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const status = data?.last_email_status;
  const parsedStatus: InvitationEmailStatus | null =
    status === "pending" || status === "sent" || status === "failed"
      ? status
      : null;

  return buildEmailServiceDiagnostic({
    lastEmailStatus: parsedStatus,
    lastEmailErrorCode:
      typeof data?.last_email_error_code === "string"
        ? data.last_email_error_code
        : null,
    lastSendAttemptAt:
      typeof data?.last_send_attempt_at === "string"
        ? data.last_send_attempt_at
        : null,
  });
}
