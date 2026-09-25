import type { CoachApplicationMode } from "@/lib/coachProfileApplication/constants";
import { configuredAppOrigin } from "./emailDelivery";
import { sendProductEmail } from "./productEmail";
import { REGISTRATION_SENDER, registrationCopies, registrationTemplate } from "./registrationTemplate";

type AppStatus = "submitted" | "changes_requested" | "approved" | "declined";

async function deliver(input: { to: string; title: string; paragraphs: string[]; note?: string | null; path: string; label: string }) {
  const origin = configuredAppOrigin();
  if (!/^https?:\/\//.test(origin)) {
    console.warn("[application-email] Missing NEXT_PUBLIC_APP_URL; email not sent.");
    return;
  }
  await sendProductEmail({
    to: input.to, from: REGISTRATION_SENDER, replyTo: "hello@padelpathways.com",
    bcc: registrationCopies(input.to), subject: input.title, logLabel: "application-email",
    html: registrationTemplate({ title: input.title, paragraphs: input.paragraphs, note: input.note,
      origin, actionLabel: input.label, actionUrl: `${origin}${input.path}` }),
  });
}

async function notifyAdmin(kind: "coach" | "venue", applicationId: string, name?: string | null) {
  const to = process.env.APPLICATION_NOTIFY_EMAIL?.trim();
  if (!to) { console.warn("[application-email] APPLICATION_NOTIFY_EMAIL not configured"); return; }
  await deliver({ to, title: `New ${kind} application to review`,
    paragraphs: [`${name?.trim() || "An applicant"} has submitted a ${kind} application.`,
      kind === "coach" ? "Open the application to review the details and approve or decline it. Approval publishes the coach profile. You must sign in with an authorised admin account." : "Sign in to review the venue details and approve, request changes or decline the application."],
    path: `/admin/applications/${kind === "coach" ? "coaches" : "venues"}/${encodeURIComponent(applicationId)}${kind === "coach" ? "#decision" : ""}`,
    label: kind === "coach" ? "Review and approve coach" : "Review venue application" });
}

async function statusEmail(input: {
  kind: "coach" | "venue"; to: string; status: AppStatus; mode: string | null;
  name?: string | null; note?: string | null; applicationId?: string;
}) {
  const kind = input.kind;
  const claim = input.mode === "claim_existing";
  const item = `${kind} ${claim ? "profile claim" : "application"}`;
  const copy: Record<AppStatus, { title: string; paragraphs: string[]; label: string }> = {
    submitted: { title: `We’ve received your ${item}`, paragraphs: ["Thanks for taking the next step with Padel Pathways.", `Our team will review your ${item} and email you when there is an update. You can check its progress from your dashboard.`], label: "View application progress" },
    changes_requested: { title: `A few updates to your ${item}`, paragraphs: ["Our team has reviewed your details. Please make the updates below and resubmit when you are ready."], label: "Update my application" },
    approved: { title: `Your ${item} is approved`, paragraphs: [kind === "coach" ? "Welcome to the coaching community. Your coach profile is now published." : "Welcome to Padel Pathways. You can now manage your venue from your account.", kind === "coach" ? "Visit your dashboard to add photos, connect your coaching venues and set up session availability." : "Visit your dashboard to complete your venue details and keep your profile up to date."], label: "Open my dashboard" },
    declined: { title: `An update on your ${item}`, paragraphs: [`Thank you for your interest in Padel Pathways. We have reviewed your ${item} and are unable to approve it at this time.`, "You can read our feedback below. If you have questions, reply to this email and our team will help."], label: "View my application" },
  };
  const selected = copy[input.status];
  await deliver({ to: input.to, ...selected, note: input.note,
    path: input.status === "approved" ? "/account" : `/account/applications/${kind}` });
  if (input.status === "submitted" && input.applicationId) {
    await notifyAdmin(kind, input.applicationId, input.name);
  }
}

export async function sendCoachApplicationStatusEmail(input: { to: string; status: AppStatus; mode: CoachApplicationMode; coachName?: string | null; note?: string | null; applicationId?: string }): Promise<void> {
  await statusEmail({ ...input, kind: "coach", name: input.coachName });
}
export async function sendVenueApplicationStatusEmail(input: { to: string; status: AppStatus; mode: "create_new" | "claim_existing" | null; venueName?: string | null; note?: string | null; applicationId?: string }): Promise<void> {
  await statusEmail({ ...input, kind: "venue", name: input.venueName });
}
export async function sendCoachApplicationWithdrawnEmails(input: { applicantEmail: string; previousStatus: string; mode: CoachApplicationMode; coachName?: string | null }): Promise<void> {
  if (input.applicantEmail.trim()) await deliver({ to: input.applicantEmail, title: "Your coach application has been withdrawn", paragraphs: ["Your coach application has been withdrawn. You can return to your dashboard whenever you are ready."], path: "/account", label: "Open my dashboard" });
  const to = process.env.APPLICATION_NOTIFY_EMAIL?.trim() || process.env.ENQUIRY_NOTIFY_EMAIL?.trim();
  if (to && ["submitted", "under_review"].includes(input.previousStatus)) await deliver({ to, title: "Coach application withdrawn", paragraphs: [`${input.coachName?.trim() || "An applicant"} has withdrawn their coach application.`], path: "/admin/applications/coaches", label: "View applications" });
}
