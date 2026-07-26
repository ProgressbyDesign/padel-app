import type { CoachApplicationMode } from "@/lib/coachProfileApplication/constants";
import {
  escapeEmailHtml,
  sendProductEmail,
} from "@/lib/notifications/productEmail";

type AppStatus = "submitted" | "changes_requested" | "approved" | "declined";

function coachCopy(
  status: AppStatus,
  mode: CoachApplicationMode,
  coachName: string | null | undefined
) {
  const isClaim = mode === "claim_existing";
  const name = coachName?.trim() || "your coach profile";

  if (status === "submitted") {
    return {
      subject: isClaim
        ? "Coach profile claim submitted"
        : "Coach application submitted",
      body: isClaim
        ? `We received your claim for ${escapeEmailHtml(name)}. Our team will review it shortly.`
        : `We received your coach application. Our team will review it shortly.`,
    };
  }
  if (status === "changes_requested") {
    return {
      subject: isClaim
        ? "Updates needed on your coach profile claim"
        : "Updates needed on your coach application",
      body: isClaim
        ? `Please update your claim for ${escapeEmailHtml(name)} and resubmit.`
        : `Please update your coach application and resubmit.`,
    };
  }
  if (status === "approved") {
    return {
      subject: isClaim
        ? "Your coach profile claim has been approved"
        : "Your coach application has been approved",
      body: isClaim
        ? `Your coach profile claim has been approved. You can manage ${escapeEmailHtml(name)} from your account.`
        : `Your coach application has been approved. You can continue completing your profile from your account.`,
    };
  }
  return {
    subject: isClaim
      ? "Your coach profile claim was not approved"
      : "Your coach application was not approved",
    body: isClaim
      ? `Your coach profile claim was not approved.`
      : `Your coach application was not approved.`,
  };
}

export async function sendCoachApplicationWithdrawnEmails(input: {
  applicantEmail: string;
  previousStatus: string;
  mode: CoachApplicationMode;
  coachName?: string | null;
}): Promise<void> {
  if (input.applicantEmail.trim()) {
    await sendProductEmail({
      logLabel: "application-email",
      to: input.applicantEmail.trim(),
      subject: "Your coach application has been withdrawn",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#031322">
          <h1 style="font-size:20px">Coach application withdrawn</h1>
          <p>Your coach application has been withdrawn.</p>
          <p style="color:#5b6770">— Padel Pathways</p>
        </div>
      `,
    });
  }

  const notifyOps =
    input.previousStatus === "submitted" ||
    input.previousStatus === "under_review";
  if (!notifyOps) return;

  const opsTo = process.env.ENQUIRY_NOTIFY_EMAIL?.trim();
  if (!opsTo) {
    console.warn(
      "[application-email] ops notify skipped: ENQUIRY_NOTIFY_EMAIL not set"
    );
    return;
  }

  const isClaim = input.mode === "claim_existing";
  const name = escapeEmailHtml(input.coachName?.trim() || "unnamed applicant");
  await sendProductEmail({
    logLabel: "application-email",
    to: opsTo,
    subject: isClaim
      ? "Coach profile claim withdrawn"
      : "Coach application withdrawn",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#031322">
        <h1 style="font-size:20px">Application withdrawn</h1>
        <p>
          A ${isClaim ? "coach profile claim" : "coach application"} for
          ${name} was withdrawn after status
          <strong>${escapeEmailHtml(input.previousStatus)}</strong>.
        </p>
        <p style="color:#5b6770">— Padel Pathways</p>
      </div>
    `,
  });
}

export async function sendCoachApplicationStatusEmail(input: {
  to: string;
  status: AppStatus;
  mode: CoachApplicationMode;
  coachName?: string | null;
  note?: string | null;
}): Promise<void> {
  const copy = coachCopy(input.status, input.mode, input.coachName);
  const noteHtml = input.note?.trim()
    ? `<p><strong>Note from the review team</strong><br/>${escapeEmailHtml(input.note.trim())}</p>`
    : "";
  await sendProductEmail({
    logLabel: "application-email",
    to: input.to,
    subject: copy.subject,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#031322">
        <h1 style="font-size:20px">${escapeEmailHtml(copy.subject)}</h1>
        <p>${copy.body}</p>
        ${noteHtml}
        <p style="color:#5b6770">— Padel Pathways</p>
      </div>
    `,
  });
}

export async function sendVenueApplicationStatusEmail(input: {
  to: string;
  status: AppStatus;
  mode: "create_new" | "claim_existing" | null;
  venueName?: string | null;
  note?: string | null;
}): Promise<void> {
  const isClaim = input.mode === "claim_existing";
  const venue = input.venueName?.trim() || "your venue";
  let subject = "Venue application update";
  let body = "Your venue application status has been updated.";

  if (input.status === "submitted") {
    subject = isClaim ? "Venue claim submitted" : "Venue application submitted";
    body = isClaim
      ? `We received your claim for ${escapeEmailHtml(venue)}.`
      : `We received your venue application.`;
  } else if (input.status === "changes_requested") {
    subject = "Updates needed on your venue application";
    body = `Please update your venue application and resubmit.`;
  } else if (input.status === "approved") {
    subject = isClaim
      ? "Your venue claim has been approved"
      : "Your venue application has been approved";
    body = isClaim
      ? `Your venue claim has been approved. You can manage ${escapeEmailHtml(venue)} from your account.`
      : `Your venue application has been approved.`;
  } else if (input.status === "declined") {
    subject = isClaim
      ? "Your venue claim was not approved"
      : "Your venue application was not approved";
    body = isClaim
      ? `Your venue claim was not approved.`
      : `Your venue application was not approved.`;
  }

  const noteHtml = input.note?.trim()
    ? `<p><strong>Note from the review team</strong><br/>${escapeEmailHtml(input.note.trim())}</p>`
    : "";

  await sendProductEmail({
    logLabel: "application-email",
    to: input.to,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#031322">
        <h1 style="font-size:20px">${escapeEmailHtml(subject)}</h1>
        <p>${body}</p>
        ${noteHtml}
        <p style="color:#5b6770">— Padel Pathways</p>
      </div>
    `,
  });
}
