"use server";

import { revalidatePath } from "next/cache";
import { coachVenueMutationErrorMessage } from "@/lib/coachVenues/errors";
import type { RelationshipActionResult } from "@/lib/coachVenues/types";
import {
  loadCoachVenueById,
  searchVenuesForCoachRelationship,
} from "@/lib/queries/coachVenueRelationships";
import { isValidCoachId } from "@/lib/queries/managedCoachShell";
import { isValidVenueId } from "@/lib/queries/managedVenueShell";
import { createClient } from "@/lib/supabase/server";

async function requireCoachMember(coachId: string): Promise<string | null> {
  if (!isValidCoachId(coachId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string" || !userId) return null;

  const { data: membership, error: membershipError } = await supabase
    .from("coach_memberships")
    .select("coach_id")
    .eq("coach_id", coachId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError || !membership) return null;
  return userId;
}

function revalidateCoachVenuePaths(coachId: string, venueId: string) {
  revalidatePath("/account");
  revalidatePath(`/account/coaches/${coachId}`);
  revalidatePath(`/account/coaches/${coachId}/venues`);
  revalidatePath(`/account/venues/${venueId}`);
  revalidatePath(`/account/venues/${venueId}/coaches`);
  revalidatePath(`/coach/${coachId}`);
  revalidatePath(`/venue/${venueId}`);
}

export async function searchVenuesForCoachRelationshipAction(
  coachId: string,
  term: string
): Promise<
  | { ok: true; venues: Awaited<ReturnType<typeof searchVenuesForCoachRelationship>> }
  | { ok: false; message: string }
> {
  const userId = await requireCoachMember(coachId);
  if (!userId) return { ok: false, message: "You do not have access to this coach." };
  try {
    return { ok: true, venues: await searchVenuesForCoachRelationship(coachId, term) };
  } catch {
    return { ok: false, message: "Venue search failed." };
  }
}

export async function requestCoachVenueRelationship(
  coachId: string,
  venueId: string
): Promise<RelationshipActionResult> {
  const userId = await requireCoachMember(coachId);
  if (!userId) return { ok: false, message: "You do not have access to this coach." };
  if (!isValidVenueId(venueId)) return { ok: false, message: "Select a valid venue." };

  const supabase = await createClient();
  const { data: venue, error: venueError } = await supabase
    .from("venues")
    .select("id")
    .eq("id", venueId)
    .maybeSingle();
  if (venueError || !venue) return { ok: false, message: "That venue could not be found." };

  const { error } = await supabase.from("coach_venues").insert({
    coach_id: coachId,
    venue_id: venueId,
    initiated_by: "coach",
  });

  if (error) {
    return { ok: false, message: coachVenueMutationErrorMessage(error) };
  }

  revalidateCoachVenuePaths(coachId, venueId);
  return { ok: true, message: "Venue request sent." };
}

export async function acceptCoachVenueRelationship(
  relationshipId: string
): Promise<RelationshipActionResult> {
  return mutateCoachSideStatus(relationshipId, "active", "Invitation accepted.");
}

export async function declineCoachVenueRelationship(
  relationshipId: string
): Promise<RelationshipActionResult> {
  return mutateCoachSideStatus(relationshipId, "declined", "Invitation declined.");
}

export async function cancelCoachVenueRelationship(
  relationshipId: string
): Promise<RelationshipActionResult> {
  const relationship = await loadCoachVenueById(relationshipId);
  if (!relationship) return { ok: false, message: "Relationship not found." };

  const userId = await requireCoachMember(relationship.coach_id);
  if (!userId) return { ok: false, message: "You do not have access to this coach." };

  if (relationship.status !== "pending" || relationship.initiated_by !== "coach") {
    return { ok: false, message: "Only your pending venue requests can be cancelled." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_venues")
    .update({ status: "cancelled" })
    .eq("id", relationshipId)
    .eq("status", "pending")
    .eq("initiated_by", "coach")
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      message: coachVenueMutationErrorMessage(error, "The request could not be cancelled."),
    };
  }

  revalidateCoachVenuePaths(relationship.coach_id, relationship.venue_id);
  return { ok: true, message: "Request cancelled." };
}

export async function endCoachVenueRelationship(
  relationshipId: string
): Promise<RelationshipActionResult> {
  return mutateCoachSideStatus(relationshipId, "ended", "Relationship ended.", {
    requireActive: true,
  });
}

async function mutateCoachSideStatus(
  relationshipId: string,
  status: "active" | "declined" | "ended",
  successMessage: string,
  options?: { requireActive?: boolean }
): Promise<RelationshipActionResult> {
  const relationship = await loadCoachVenueById(relationshipId);
  if (!relationship) return { ok: false, message: "Relationship not found." };

  const userId = await requireCoachMember(relationship.coach_id);
  if (!userId) return { ok: false, message: "You do not have access to this coach." };

  if (options?.requireActive) {
    if (relationship.status !== "active") {
      return { ok: false, message: "Only active relationships can be ended." };
    }
  } else if (status === "active" || status === "declined") {
    if (relationship.status !== "pending" || relationship.initiated_by !== "venue") {
      return {
        ok: false,
        message: "Only pending venue invitations can be accepted or declined.",
      };
    }
  }

  const supabase = await createClient();
  let query = supabase
    .from("coach_venues")
    .update({ status })
    .eq("id", relationshipId);

  if (status === "ended") {
    query = query.eq("status", "active");
  } else {
    query = query.eq("status", "pending").eq("initiated_by", "venue");
  }

  const { data, error } = await query.select("id").maybeSingle();
  if (error || !data) {
    return {
      ok: false,
      message: coachVenueMutationErrorMessage(error, "The relationship could not be updated."),
    };
  }

  revalidateCoachVenuePaths(relationship.coach_id, relationship.venue_id);
  return { ok: true, message: successMessage };
}

export async function setPrimaryCoachVenue(
  relationshipId: string,
  isPrimary: boolean
): Promise<RelationshipActionResult> {
  const relationship = await loadCoachVenueById(relationshipId);
  if (!relationship) return { ok: false, message: "Relationship not found." };

  const userId = await requireCoachMember(relationship.coach_id);
  if (!userId) return { ok: false, message: "You do not have access to this coach." };

  if (relationship.status !== "active" && relationship.status !== "unverified") {
    return {
      ok: false,
      message: "Only active or imported relationships can be marked primary.",
    };
  }

  // Prefer primary on verified active links in the product UI.
  if (isPrimary && relationship.status !== "active") {
    return {
      ok: false,
      message:
        "Choose an active verified venue as primary. Imported associations need admin verification first.",
    };
  }

  const supabase = await createClient();

  if (isPrimary) {
    const { error: clearError } = await supabase
      .from("coach_venues")
      .update({ is_primary: false })
      .eq("coach_id", relationship.coach_id)
      .eq("is_primary", true)
      .neq("id", relationshipId);

    if (clearError) {
      return {
        ok: false,
        message: coachVenueMutationErrorMessage(
          clearError,
          "The current primary venue could not be cleared."
        ),
      };
    }
  }

  const { data, error } = await supabase
    .from("coach_venues")
    .update({ is_primary: isPrimary })
    .eq("id", relationshipId)
    .in("status", isPrimary ? ["active"] : ["active", "unverified"])
    .select("id, is_primary")
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      message: coachVenueMutationErrorMessage(
        error,
        isPrimary
          ? "That venue could not be set as primary."
          : "Primary could not be removed."
      ),
    };
  }

  revalidateCoachVenuePaths(relationship.coach_id, relationship.venue_id);
  return {
    ok: true,
    message: isPrimary ? "Primary venue updated." : "Primary venue cleared.",
  };
}
