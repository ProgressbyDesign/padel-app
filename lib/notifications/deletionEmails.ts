import type { DeletionResponsibilitySummary } from "@/lib/accountDeletion/types";
import {
  escapeEmailHtml,
  sendProductEmail,
} from "@/lib/notifications/productEmail";

function wrap(subject: string, bodyHtml: string): string {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#031322">
      <h1 style="font-size:20px">${escapeEmailHtml(subject)}</h1>
      ${bodyHtml}
      <p style="color:#5b6770">— Padel Pathways</p>
    </div>
  `;
}

export async function sendDeletionSubmittedEmail(to: string): Promise<void> {
  if (!to.trim()) return;
  const subject = "Your account deletion request has been received";
  await sendProductEmail({
    logLabel: "deletion-email",
    to: to.trim(),
    subject,
    html: wrap(
      subject,
      `<p>We received your account deletion request. Our team will review your account responsibilities and contact you before permanent deletion.</p>`
    ),
  });
}

export async function sendDeletionCancelledEmail(to: string): Promise<void> {
  if (!to.trim()) return;
  const subject = "Your account deletion request has been cancelled";
  await sendProductEmail({
    logLabel: "deletion-email",
    to: to.trim(),
    subject,
    html: wrap(
      subject,
      `<p>Your account deletion request has been cancelled. You can continue using your account as usual.</p>`
    ),
  });
}

export async function sendDeletionProcessingEmail(to: string): Promise<void> {
  if (!to.trim()) return;
  const subject = "We are reviewing your account deletion request";
  await sendProductEmail({
    logLabel: "deletion-email",
    to: to.trim(),
    subject,
    html: wrap(
      subject,
      `<p>We are reviewing your account deletion request. We may contact you if we need more information about managed profiles or bookings.</p>`
    ),
  });
}

export async function sendDeletionDeclinedEmail(to: string): Promise<void> {
  if (!to.trim()) return;
  const subject = "We could not complete your account deletion request";
  await sendProductEmail({
    logLabel: "deletion-email",
    to: to.trim(),
    subject,
    html: wrap(
      subject,
      `<p>We could not complete your account deletion request. Please contact support if you still need help.</p>`
    ),
  });
}

export async function sendDeletionOpsSubmittedEmail(input: {
  userId: string;
  requesterEmail: string;
  requestedAt: string;
  responsibility: DeletionResponsibilitySummary;
}): Promise<void> {
  const opsTo = process.env.ENQUIRY_NOTIFY_EMAIL?.trim();
  if (!opsTo) {
    console.warn(
      "[deletion-email] ops notify skipped: ENQUIRY_NOTIFY_EMAIL not set"
    );
    return;
  }

  const subject = "Account deletion request submitted";
  const r = input.responsibility;
  await sendProductEmail({
    logLabel: "deletion-email",
    to: opsTo,
    subject,
    html: wrap(
      subject,
      `
        <p>A user requested account deletion.</p>
        <ul>
          <li>User ID: ${escapeEmailHtml(input.userId)}</li>
          <li>Email: ${escapeEmailHtml(input.requesterEmail)}</li>
          <li>Requested: ${escapeEmailHtml(input.requestedAt)}</li>
          <li>Coach profiles: ${r.coachCount}</li>
          <li>Venues: ${r.venueCount}</li>
          <li>Future player bookings: ${r.futurePlayerBookings}</li>
          <li>Coach bookings awaiting action: ${r.coachPendingBookings}</li>
        </ul>
      `
    ),
  });
}
