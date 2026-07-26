import "server-only";

import { sendRelationshipEmail } from "@/lib/notifications/relationshipEmails";
import { resolveCoachContactEmail } from "@/lib/notifications/resolveRecipientEmail";
import { createClient } from "@/lib/supabase/server";

export async function notifyCoachVenueRelationship(input: {
  kind:
    | "coach_request"
    | "venue_invite"
    | "accepted"
    | "declined"
    | "cancelled"
    | "ended";
  coachId: string;
  venueId: string;
  /** Who should receive the email when a reliable address exists. */
  recipient: "coach" | "venue";
}): Promise<void> {
  const supabase = await createClient();
  const [{ data: coach }, { data: venue }] = await Promise.all([
    supabase.from("coaches").select("name, email").eq("id", input.coachId).maybeSingle(),
    supabase.from("venues").select("name").eq("id", input.venueId).maybeSingle(),
  ]);

  const coachName = coach?.name?.trim() || "Coach";
  const venueName = venue?.name?.trim() || "Venue";

  let to: string | null = null;
  if (input.recipient === "coach") {
    const fromRow =
      typeof coach?.email === "string" && coach.email.includes("@")
        ? coach.email.trim()
        : null;
    to = fromRow || (await resolveCoachContactEmail(input.coachId));
  }
  // Venue public contact email is not available without migrations / service-role.

  void sendRelationshipEmail({
    to,
    kind: input.kind,
    coachName,
    venueName,
  });
}
