import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type AdminRole,
} from "@/lib/admin/permissions";
import { maskEmail } from "@/lib/admin/invitationToken";
import {
  absoluteAppUrl,
  configuredAppOrigin,
} from "@/lib/notifications/emailDelivery";
import {
  configuredSenderAddress,
} from "@/lib/notifications/emailServiceDiagnostic";
import { logInvitationEmailAttempt } from "@/lib/notifications/invitationEmailLog";
import {
  escapeEmailHtml,
  sendEmailWithResult,
  sendProductEmail,
} from "@/lib/notifications/productEmail";
import type { EmailDeliveryResult } from "@/lib/notifications/emailDelivery";

export async function sendAdminInvitationEmail(input: {
  invitationId: string;
  to: string;
  inviterName: string;
  role: AdminRole;
  expiresAt: string;
  acceptPath: string;
}): Promise<EmailDeliveryResult> {
  const origin = configuredAppOrigin();
  if (!origin && process.env.NODE_ENV === "development") {
    console.warn(
      "[admin-invitation] NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_SITE_URL missing — accept link may be relative"
    );
  }

  const href = absoluteAppUrl(input.acceptPath);
  const senderAddress = configuredSenderAddress();

  const delivery = await sendEmailWithResult({
    to: input.to,
    subject: "You’re invited to join the Padel Pathways admin team",
    logLabel: "admin-invitation",
    html: `
      <p>${escapeEmailHtml(input.inviterName)} invited you to the Padel Pathways admin team.</p>
      <p><strong>Role:</strong> ${escapeEmailHtml(ROLE_LABELS[input.role])}</p>
      <p>${escapeEmailHtml(ROLE_DESCRIPTIONS[input.role])}</p>
      <p>This invitation expires on ${escapeEmailHtml(
        new Intl.DateTimeFormat("en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(input.expiresAt))
      )} and is tied to ${escapeEmailHtml(maskEmail(input.to))}.</p>
      <p><a href="${escapeEmailHtml(href)}">Accept invitation</a></p>
      <p>If you were not expecting this email, you can ignore it.</p>
    `,
  });

  logInvitationEmailAttempt({
    invitationId: input.invitationId,
    recipient: input.to,
    senderAddress,
    outcome: delivery.ok ? "sent" : "failed",
    providerMessageId: delivery.ok ? delivery.providerId : null,
    errorCode: delivery.ok ? null : delivery.errorCode,
  });

  return delivery;
}

export async function sendAdminTeamNoticeEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  await sendProductEmail({
    to: input.to,
    subject: input.subject,
    html: input.html,
    logLabel: "admin-team-notice",
  });
}
