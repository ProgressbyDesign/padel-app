import {
  PADEL_PATHWAYS_REPLY_TO,
  PADEL_PATHWAYS_SENDER,
  brandedEmailTemplate,
  emailTestCopies,
} from "@/lib/notifications/brandedEmail";
import { configuredAppOrigin } from "@/lib/notifications/emailDelivery";
import { sendEmailWithResult } from "@/lib/notifications/productEmail";

export type RegistrationIntentLabel = "Player" | "Coach" | "Venue" | "Account";

export function registrationConfirmationEligible(input: {
  isRecovery: boolean;
  nextPath: string;
}): boolean {
  if (input.isRecovery || input.nextPath === "/reset-password") return false;
  if (input.nextPath.startsWith("/admin/invitations")) return false;
  if (input.nextPath === "/account/settings") return false;
  return true;
}

export function registrationIntentLabel(value: unknown): RegistrationIntentLabel {
  if (value === "coach") return "Coach";
  if (value === "venue") return "Venue";
  if (value === "player") return "Player";
  return "Account";
}

export type RegistrationAccountSnapshot = {
  name: string;
  email: string;
  intent: RegistrationIntentLabel;
  confirmedAt: string | null;
};

type SendResult = { ok: true } | { ok: false; errorCode: string };

/**
 * Claim-then-send. A lost claim means this user was already notified.
 * One immediate retry covers a transient provider failure. The claim stays
 * taken afterwards so a later login or callback cannot send a duplicate.
 */
export async function maybeSendRegistrationAdminNotification(input: {
  isRecovery: boolean;
  nextPath: string;
  notifyEmail?: string | null;
  claim: () => Promise<boolean>;
  loadAccount: () => Promise<RegistrationAccountSnapshot | null>;
  send?: (html: string, subject: string, to: string) => Promise<SendResult>;
}): Promise<"skipped" | "unconfigured" | "missing_account" | "already_claimed" | "sent" | "failed"> {
  if (!registrationConfirmationEligible(input)) return "skipped";

  const to = (input.notifyEmail ?? process.env.REGISTRATION_NOTIFY_EMAIL ?? "").trim();
  if (!to) {
    console.warn("[registration-email] REGISTRATION_NOTIFY_EMAIL not configured");
    return "unconfigured";
  }

  const account = await input.loadAccount();
  if (!account?.email.trim()) return "missing_account";

  let claimed = false;
  try {
    claimed = await input.claim();
  } catch {
    console.warn("[registration-email] claim failed");
    return "failed";
  }
  if (!claimed) return "already_claimed";

  const origin = configuredAppOrigin();
  const html = brandedEmailTemplate({
    title: "New Padel Pathways account",
    paragraphs: ["A new user has confirmed their Padel Pathways account."],
    details: [
      { label: "Name", value: account.name.trim() || "Not provided" },
      { label: "Email", value: account.email.trim() },
      { label: "Intent", value: account.intent },
      ...(account.confirmedAt
        ? [{ label: "Confirmed", value: account.confirmedAt }]
        : []),
    ],
    actionLabel: origin ? "Open admin" : null,
    actionUrl: origin ? `${origin}/admin` : null,
    origin,
  });

  const send =
    input.send ??
    (async (body, subject, recipient) => {
      const result = await sendEmailWithResult({
        to: recipient,
        subject,
        html: body,
        from: PADEL_PATHWAYS_SENDER,
        replyTo: PADEL_PATHWAYS_REPLY_TO,
        bcc: emailTestCopies(recipient),
        logLabel: "registration-email",
      });
      return result.ok
        ? { ok: true as const }
        : { ok: false as const, errorCode: result.errorCode };
    });

  let result = await send(html, "New Padel Pathways account", to);
  if (!result.ok) {
    result = await send(html, "New Padel Pathways account", to);
  }
  if (!result.ok) {
    console.warn("[registration-email] send failed:", result.errorCode);
    return "failed";
  }
  return "sent";
}
