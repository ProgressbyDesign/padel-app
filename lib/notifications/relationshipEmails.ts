import {
  escapeEmailHtml,
  sendProductEmail,
} from "@/lib/notifications/productEmail";

type RelationshipEmailKind =
  | "coach_request"
  | "venue_invite"
  | "accepted"
  | "declined"
  | "cancelled"
  | "ended";

export async function sendRelationshipEmail(input: {
  to: string | null | undefined;
  kind: RelationshipEmailKind;
  coachName: string;
  venueName: string;
}): Promise<void> {
  const to = input.to?.trim();
  if (!to) {
    console.warn(
      "[relationship-email] skipped: no reliable recipient email",
      input.kind
    );
    return;
  }

  const coach = escapeEmailHtml(input.coachName.trim() || "Coach");
  const venue = escapeEmailHtml(input.venueName.trim() || "Venue");

  const copy: Record<RelationshipEmailKind, { subject: string; body: string }> =
    {
      coach_request: {
        subject: `${input.coachName.trim() || "A coach"} requested to link with ${input.venueName.trim() || "your venue"}`,
        body: `${coach} requested a coaching relationship with ${venue}. Review the request in your account.`,
      },
      venue_invite: {
        subject: `${input.venueName.trim() || "A venue"} invited you to link`,
        body: `${venue} invited ${coach} to join as a coach. Review the invitation in your account.`,
      },
      accepted: {
        subject: "Coach–venue relationship accepted",
        body: `The relationship between ${coach} and ${venue} is now active.`,
      },
      declined: {
        subject: "Coach–venue relationship declined",
        body: `The relationship request between ${coach} and ${venue} was declined.`,
      },
      cancelled: {
        subject: "Coach–venue relationship cancelled",
        body: `The pending relationship between ${coach} and ${venue} was cancelled.`,
      },
      ended: {
        subject: "Coach–venue relationship ended",
        body: `The relationship between ${coach} and ${venue} has ended.`,
      },
    };

  const selected = copy[input.kind];
  await sendProductEmail({
    logLabel: "relationship-email",
    to,
    subject: selected.subject,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#031322">
        <h1 style="font-size:20px">${escapeEmailHtml(selected.subject)}</h1>
        <p>${selected.body}</p>
        <p style="color:#5b6770">— Padel Pathways</p>
      </div>
    `,
  });
}
