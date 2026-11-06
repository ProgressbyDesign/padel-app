import "server-only";
import { brandedEmailTemplate, PADEL_PATHWAYS_SENDER } from "@/lib/notifications/brandedEmail";
import { getAdminAccount } from "@/lib/auth/adminSession";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { reviewClient } from "./access";

export const notificationCopy = {
  review_ready: ["An assessment is ready for review", "Valid footage is available. Open your assigned assessment to review the purchased criteria and deadline."],
  replacement_requested: ["Your assessor needs replacement footage", "Open your assessment for the recording issue and guidance. Replace the footage under the same order without another payment."],
  assessment_completed: ["Your assessment feedback is ready", "Your assessor has completed the professional assessment. Read the feedback, criteria and recommended next practice."],
  skill_verified: ["A skill milestone has been verified", "An authorised assessor has verified this skill against its versioned standard. Open your private Passport for the evidence-linked record."],
  deadline_approaching: ["Assessment review target approaching", "An assigned assessment is approaching its review target. Please review the evidence or ask an administrator for resolution."],
  deadline_overdue: ["Assessment review target exceeded", "An assigned assessment is overdue. Please review it or arrange an administrator resolution. This reminder does not issue a refund."],
} as const;
export type NotificationIntent = { id: string; event_key: string; kind: keyof typeof notificationCopy; order_id: string; recipient_user_id: string; created_at: string };
/** Preview only: no recipient email resolution, Resend import or send function. */
export function previewAssessmentNotification(intent: NotificationIntent, origin: string) {
  const url = new URL(origin);
  if (url.origin !== origin || url.protocol !== "http:" || url.hostname !== "127.0.0.1") throw new Error("Email preview requires the isolated local app.");
  const copy = notificationCopy[intent.kind];
  if (!copy) throw new Error("Unknown notification kind.");
  const coach = ["review_ready", "deadline_approaching", "deadline_overdue"].includes(intent.kind);
  const path = coach ? "/account" : intent.kind === "skill_verified" ? "/account/development/passport" : `/account/development/assessments/${intent.order_id}`;
  return { from: PADEL_PATHWAYS_SENDER, subject: copy[0], idempotencyKey: `passport:${intent.id}`, delivery: "preview_only" as const,
    html: brandedEmailTemplate({ title: copy[0], paragraphs: [copy[1]], eyebrow: "PROGRESS PASSPORT · LOCAL PREVIEW", origin, actionLabel: coach ? "Open coach dashboard" : "Open my assessment", actionUrl: origin + path }),
  };
}
export async function loadAssessmentAdminPreview() {
  const { client } = await reviewClient();
  if (!hasAdminPermission(await getAdminAccount(), "bookings.manage")) throw new Error("Administrator required.");
  const [watch, intents] = await Promise.all([
    client.from("pp_replacement_watch").select("*").order("last_requested_at", { ascending: false }).limit(100),
    client.rpc("passport_notification_preview"),
  ]);
  if (watch.error || intents.error) throw new Error("Assessment administration is unavailable.");
  return { watch: watch.data as { order_id: string; skill_id: string; state: string; replacement_count: number; last_requested_at: string }[], intents: intents.data as NotificationIntent[] };
}
