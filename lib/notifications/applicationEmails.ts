import type { CoachApplicationMode } from "@/lib/coachProfileApplication/constants";
import {
  PADEL_PATHWAYS_REPLY_TO,
  PADEL_PATHWAYS_SENDER,
  brandedEmailTemplate,
  emailTestCopies,
} from "./brandedEmail";
import { configuredAppOrigin } from "./emailDelivery";
import { sendProductEmail } from "./productEmail";

type AppKind = "coach" | "venue";
type AppStatus = "submitted" | "changes_requested" | "approved" | "declined";

function applicationPath(kind: AppKind, applicationId: string): string {
  const section = kind === "coach" ? "coaches" : "venues";
  return `/admin/applications/${section}/${encodeURIComponent(applicationId)}`;
}

function applicantProgressPath(kind: AppKind): string {
  return `/account/applications/${kind}`;
}

function approvedPath(kind: AppKind, entityId?: string | null): string {
  if (kind === "coach" && entityId) {
    return `/account/coaches/${encodeURIComponent(entityId)}`;
  }
  if (kind === "venue" && entityId) {
    return `/account/venues/${encodeURIComponent(entityId)}`;
  }
  return "/account";
}

async function deliver(input: {
  to: string;
  subject: string;
  title: string;
  paragraphs: string[];
  note?: string | null;
  path: string;
  label: string;
}) {
  const origin = configuredAppOrigin();
  if (!/^https?:\/\//.test(origin)) {
    console.warn("[application-email] Missing NEXT_PUBLIC_APP_URL; email not sent.");
    return;
  }
  await sendProductEmail({
    to: input.to,
    from: PADEL_PATHWAYS_SENDER,
    replyTo: PADEL_PATHWAYS_REPLY_TO,
    bcc: emailTestCopies(input.to, { includeLegacyRegistration: true }),
    subject: input.subject,
    logLabel: "application-email",
    html: brandedEmailTemplate({
      title: input.title,
      paragraphs: input.paragraphs,
      note: input.note,
      origin,
      actionLabel: input.label,
      actionUrl: `${origin}${input.path}`,
    }),
  });
}

async function notifyAdmin(input: {
  kind: AppKind;
  applicationId: string;
  name?: string | null;
}) {
  const to = process.env.APPLICATION_NOTIFY_EMAIL?.trim();
  if (!to) {
    console.warn("[application-email] APPLICATION_NOTIFY_EMAIL not configured");
    return;
  }
  const name = input.name?.trim() || "An applicant";
  const subject =
    input.kind === "coach"
      ? `New coach application — ${name}`
      : `New venue application — ${name}`;
  await deliver({
    to,
    subject,
    title: subject,
    paragraphs: [
      `${name} has submitted a ${input.kind} application.`,
      "Open the application to review the details. Approval and publication are separate steps. You must sign in with an authorised admin account.",
    ],
    path: applicationPath(input.kind, input.applicationId),
    label: "Review application",
  });
}

function statusCopy(input: {
  kind: AppKind;
  status: AppStatus;
  claim: boolean;
  entityId?: string | null;
}): { subject: string; title: string; paragraphs: string[]; label: string; path: string } {
  const item = `${input.kind} ${input.claim ? "profile claim" : "application"}`;
  if (input.status === "submitted") {
    return {
      subject: `We've received your ${item}`,
      title: `We've received your ${item}`,
      paragraphs: [
        "Thanks for taking the next step with Padel Pathways.",
        `Your ${item} has been received. Our team will review it and email you when there is an update.`,
        "You can monitor progress from your account. Submitting an application does not publish a profile.",
      ],
      label: "View application progress",
      path: applicantProgressPath(input.kind),
    };
  }
  if (input.status === "changes_requested") {
    return {
      subject: `Updates needed on your ${item}`,
      title: `Updates needed on your ${item}`,
      paragraphs: [
        `Our team has reviewed your ${item} and needs a few updates before it can continue.`,
        "The note below is for you. Update the application and resubmit when you are ready.",
      ],
      label: "Update my application",
      path: applicantProgressPath(input.kind),
    };
  }
  if (input.status === "approved") {
    const coach = input.kind === "coach";
    return {
      subject: `Your ${item} has been approved`,
      title: `Your ${item} has been approved`,
      paragraphs: coach
        ? [
            "Your coach application has been approved.",
            "You can now access your coach dashboard and complete your profile.",
            "Useful next steps are adding a profile photo, connecting coaching venues, setting availability and completing your profile information. Publication is handled separately.",
          ]
        : [
            "Your venue application has been approved.",
            "You can now manage your venue from your account.",
            "Publication is handled separately from this approval.",
          ],
      label: coach
        ? input.entityId
          ? "Open my coach dashboard"
          : "Open my dashboard"
        : input.entityId
          ? "Open my venue dashboard"
          : "Open my dashboard",
      path: approvedPath(input.kind, input.entityId),
    };
  }
  return {
    subject: `An update on your ${item}`,
    title: `An update on your ${item}`,
    paragraphs: [
      `Thank you for your interest in Padel Pathways. We have reviewed your ${item} and are unable to approve it at this time.`,
      "If we left feedback, it is included below. Reply to this email if you have a question.",
    ],
    label: "View my application",
    path: applicantProgressPath(input.kind),
  };
}

async function statusEmail(input: {
  kind: AppKind;
  to: string;
  status: AppStatus;
  mode: string | null;
  name?: string | null;
  note?: string | null;
  applicationId?: string;
  entityId?: string | null;
}) {
  const selected = statusCopy({
    kind: input.kind,
    status: input.status,
    claim: input.mode === "claim_existing",
    entityId: input.entityId,
  });
  await deliver({
    to: input.to,
    subject: selected.subject,
    title: selected.title,
    paragraphs: selected.paragraphs,
    note: input.note,
    path: selected.path,
    label: selected.label,
  });
  if (input.status === "submitted" && input.applicationId) {
    await notifyAdmin({
      kind: input.kind,
      applicationId: input.applicationId,
      name: input.name,
    });
  }
}

export async function sendCoachApplicationStatusEmail(input: {
  to: string;
  status: AppStatus;
  mode: CoachApplicationMode;
  coachName?: string | null;
  note?: string | null;
  applicationId?: string;
  coachId?: string | null;
}): Promise<void> {
  await statusEmail({
    ...input,
    kind: "coach",
    name: input.coachName,
    entityId: input.coachId,
  });
}

export async function sendVenueApplicationStatusEmail(input: {
  to: string;
  status: AppStatus;
  mode: "create_new" | "claim_existing" | null;
  venueName?: string | null;
  note?: string | null;
  applicationId?: string;
  venueId?: string | null;
}): Promise<void> {
  await statusEmail({
    ...input,
    kind: "venue",
    name: input.venueName,
    entityId: input.venueId,
  });
}

export async function sendCoachApplicationWithdrawnEmails(input: {
  applicantEmail: string;
  previousStatus: string;
  mode: CoachApplicationMode;
  coachName?: string | null;
  applicationId?: string | null;
}): Promise<void> {
  if (input.applicantEmail.trim()) {
    await deliver({
      to: input.applicantEmail,
      subject: "Your coach application has been withdrawn",
      title: "Your coach application has been withdrawn",
      paragraphs: [
        "Your coach application has been withdrawn.",
        "Your Padel Pathways account has not been deleted. You can return to your dashboard whenever you are ready.",
      ],
      path: "/account",
      label: "Open my dashboard",
    });
  }
  const to =
    process.env.APPLICATION_NOTIFY_EMAIL?.trim() ||
    process.env.ENQUIRY_NOTIFY_EMAIL?.trim();
  if (!to || !["submitted", "under_review"].includes(input.previousStatus)) return;
  const name = input.coachName?.trim() || "An applicant";
  await deliver({
    to,
    subject: "Coach application withdrawn",
    title: "Coach application withdrawn",
    paragraphs: [`${name} has withdrawn their coach application.`],
    path: input.applicationId
      ? applicationPath("coach", input.applicationId)
      : "/admin/applications/coaches",
    label: "View application",
  });
}

export async function sendVenueApplicationWithdrawnEmails(input: {
  applicantEmail: string;
  previousStatus: string;
  venueName?: string | null;
  applicationId?: string | null;
}): Promise<void> {
  if (input.applicantEmail.trim()) {
    await deliver({
      to: input.applicantEmail,
      subject: "Your venue application has been withdrawn",
      title: "Your venue application has been withdrawn",
      paragraphs: [
        "Your venue application has been withdrawn.",
        "Your Padel Pathways account has not been deleted. You can return to your dashboard whenever you are ready.",
      ],
      path: "/account",
      label: "Open my dashboard",
    });
  }
  const to =
    process.env.APPLICATION_NOTIFY_EMAIL?.trim() ||
    process.env.ENQUIRY_NOTIFY_EMAIL?.trim();
  if (!to || !["submitted", "under_review"].includes(input.previousStatus)) return;
  const name = input.venueName?.trim() || "An applicant";
  await deliver({
    to,
    subject: "Venue application withdrawn",
    title: "Venue application withdrawn",
    paragraphs: [`${name} has withdrawn their venue application.`],
    path: input.applicationId
      ? applicationPath("venue", input.applicationId)
      : "/admin/applications/venues",
    label: "View application",
  });
}
