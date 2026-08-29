import "server-only";

import { sendRelationshipEmail } from "@/lib/notifications/relationshipEmails";
import { resolveCoachNotificationEmail } from "@/lib/notifications/resolveRecipientEmail";
import {
  loadCoachRelationshipIdentities,
  loadVenueRelationshipIdentities,
} from "@/lib/queries/relationshipIdentities";
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
  const [coaches, venues] = await Promise.all([
    loadCoachRelationshipIdentities([input.coachId], supabase),
    loadVenueRelationshipIdentities([input.venueId], supabase),
  ]);

  let coachName = coaches.get(input.coachId)?.name?.trim() || "";
  let venueName = venues.get(input.venueId)?.name?.trim() || "";

  // Own-membership RLS only: fills the caller's unpublished profile name.
  // Linked partners cannot read the opposite base row.
  if (!coachName) {
    const { data } = await supabase
      .from("coaches")
      .select("name")
      .eq("id", input.coachId)
      .maybeSingle();
    coachName = data?.name?.trim() || "";
  }
  if (!venueName) {
    const { data } = await supabase
      .from("venues")
      .select("name")
      .eq("id", input.venueId)
      .maybeSingle();
    venueName = data?.name?.trim() || "";
  }

  let to: string | null = null;
  if (input.recipient === "coach") {
    to = await resolveCoachNotificationEmail(input.coachId);
  }
  // Venue public contact email is not available without migrations / service-role.

  void sendRelationshipEmail({
    to,
    kind: input.kind,
    coachName: coachName || "Coach",
    venueName: venueName || "Venue",
  });
}
