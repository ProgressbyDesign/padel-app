"use server";

import { revalidatePath } from "next/cache";
import {
  CURRENT_COACH_VENUE_STATUSES,
  isCoachVenueStatus,
  type CoachVenueStatus,
} from "@/lib/coachVenues/constants";
import {
  ACTIVE_CONNECTED_MESSAGE,
  DUPLICATE_MESSAGE,
  coachVenueMutationErrorMessage,
} from "@/lib/coachVenues/errors";
import type { RelationshipActionResult } from "@/lib/coachVenues/types";
import {
  loadCoachVenueById,
  searchCoachesForVenueRelationship,
} from "@/lib/queries/coachVenueRelationships";
import { isValidCoachId } from "@/lib/queries/managedCoachShell";
import { isValidVenueId } from "@/lib/queries/managedVenueShell";
import { createClient } from "@/lib/supabase/server";

async function requireVenueMember(venueId: string): Promise<string | null> {
  if (!isValidVenueId(venueId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string" || !userId) return null;

  const { data: membership, error: membershipError } = await supabase
    .from("venue_memberships")
    .select("venue_id")
    .eq("venue_id", venueId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError || !membership) return null;
  return userId;
}

function revalidateVenueCoachPaths(coachId: string, venueId: string) {
  revalidatePath("/account");
  revalidatePath("/account/personal");
  revalidatePath(`/account/venues/${venueId}`);
  revalidatePath(`/account/venues/${venueId}/schedule`);
  revalidatePath(`/account/venues/${venueId}/sessions`);
  revalidatePath(`/account/venues/${venueId}/coaches`);
  revalidatePath(`/account/venues/${venueId}/coaches/${coachId}/availability`);
  revalidatePath(`/account/coaches/${coachId}`);
  revalidatePath(`/account/coaches/${coachId}/venues`);
  revalidatePath(`/account/coaches/${coachId}/availability`);
  revalidatePath(`/venue/${venueId}`);
  revalidatePath(`/coach/${coachId}`);
}

async function findCurrentCoachVenuePair(
  coachId: string,
  venueId: string
): Promise<{ id: string; status: CoachVenueStatus } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("coach_venues")
    .select("id, status")
    .eq("coach_id", coachId)
    .eq("venue_id", venueId)
    .in("status", [...CURRENT_COACH_VENUE_STATUSES])
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const statusRaw = String(data.status ?? "");
  if (!isCoachVenueStatus(statusRaw)) return null;
  return { id: String(data.id), status: statusRaw };
}

function duplicatePairResult(
  existing: { id: string; status: CoachVenueStatus }
): RelationshipActionResult {
  if (existing.status === "active") {
    return {
      ok: false,
      alreadyConnected: true,
      relationshipId: existing.id,
      status: existing.status,
      message: ACTIVE_CONNECTED_MESSAGE,
    };
  }
  return {
    ok: false,
    relationshipId: existing.id,
    status: existing.status,
    message: DUPLICATE_MESSAGE,
  };
}

export async function searchCoachesForVenueRelationshipAction(
  venueId: string,
  term: string
): Promise<
  | { ok: true; coaches: Awaited<ReturnType<typeof searchCoachesForVenueRelationship>> }
  | { ok: false; message: string }
> {
  const userId = await requireVenueMember(venueId);
  if (!userId) return { ok: false, message: "You do not have access to this venue." };
  try {
    return { ok: true, coaches: await searchCoachesForVenueRelationship(venueId, term) };
  } catch {
    return { ok: false, message: "Coach search failed." };
  }
}

export async function inviteCoachToVenue(
  venueId: string,
  coachId: string
): Promise<RelationshipActionResult> {
  const userId = await requireVenueMember(venueId);
  if (!userId) return { ok: false, message: "You do not have access to this venue." };
  if (!isValidCoachId(coachId)) return { ok: false, message: "Select a valid coach." };

  const supabase = await createClient();
  const { data: coach, error: coachError } = await supabase
    .from("coaches")
    .select("id")
    .eq("id", coachId)
    .maybeSingle();
  if (coachError || !coach) return { ok: false, message: "That coach could not be found." };

  const existing = await findCurrentCoachVenuePair(coachId, venueId);
  if (existing) return duplicatePairResult(existing);

  const { data: inserted, error } = await supabase
    .from("coach_venues")
    .insert({
      coach_id: coachId,
      venue_id: venueId,
      initiated_by: "venue",
    })
    .select("id, status")
    .single();

  if (error) {
    if (error.code === "23505") {
      const again = await findCurrentCoachVenuePair(coachId, venueId);
      if (again) return duplicatePairResult(again);
    }
    return { ok: false, message: coachVenueMutationErrorMessage(error) };
  }

  const statusRaw = String(inserted?.status ?? "");
  const status = isCoachVenueStatus(statusRaw) ? statusRaw : "pending";
  const relationshipId = String(inserted.id);

  revalidateVenueCoachPaths(coachId, venueId);

  if (status === "active") {
    return {
      ok: true,
      activatedImmediately: true,
      status: "active",
      relationshipId,
      message: "Coach connected.",
    };
  }

  const { notifyCoachVenueRelationship } = await import(
    "@/lib/notifications/notifyRelationship"
  );
  void notifyCoachVenueRelationship({
    kind: "venue_invite",
    coachId,
    venueId,
    recipient: "coach",
  });
  return {
    ok: true,
    status,
    relationshipId,
    message: "Coach invitation sent.",
  };
}

export async function acceptVenueCoachRelationship(
  relationshipId: string
): Promise<RelationshipActionResult> {
  return mutateVenueSideStatus(relationshipId, "active", "Coach request accepted.");
}

export async function declineVenueCoachRelationship(
  relationshipId: string
): Promise<RelationshipActionResult> {
  return mutateVenueSideStatus(relationshipId, "declined", "Coach request declined.");
}

export async function cancelVenueCoachInvitation(
  relationshipId: string
): Promise<RelationshipActionResult> {
  const relationship = await loadCoachVenueById(relationshipId);
  if (!relationship) return { ok: false, message: "Relationship not found." };

  const userId = await requireVenueMember(relationship.venue_id);
  if (!userId) return { ok: false, message: "You do not have access to this venue." };

  if (relationship.status !== "pending" || relationship.initiated_by !== "venue") {
    return {
      ok: false,
      message: "Only your pending coach invitations can be cancelled.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_venues")
    .update({ status: "cancelled" })
    .eq("id", relationshipId)
    .eq("status", "pending")
    .eq("initiated_by", "venue")
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      message: coachVenueMutationErrorMessage(error, "The invitation could not be cancelled."),
    };
  }

  revalidateVenueCoachPaths(relationship.coach_id, relationship.venue_id);
  const { notifyCoachVenueRelationship } = await import(
    "@/lib/notifications/notifyRelationship"
  );
  void notifyCoachVenueRelationship({
    kind: "cancelled",
    coachId: relationship.coach_id,
    venueId: relationship.venue_id,
    recipient: "coach",
  });
  return { ok: true, message: "Invitation cancelled." };
}

export async function endVenueCoachRelationship(
  relationshipId: string
): Promise<RelationshipActionResult> {
  return mutateVenueSideStatus(relationshipId, "ended", "Relationship ended.", {
    requireActive: true,
  });
}

async function mutateVenueSideStatus(
  relationshipId: string,
  status: "active" | "declined" | "ended",
  successMessage: string,
  options?: { requireActive?: boolean }
): Promise<RelationshipActionResult> {
  const relationship = await loadCoachVenueById(relationshipId);
  if (!relationship) return { ok: false, message: "Relationship not found." };

  const userId = await requireVenueMember(relationship.venue_id);
  if (!userId) return { ok: false, message: "You do not have access to this venue." };

  if (options?.requireActive) {
    if (relationship.status !== "active") {
      return { ok: false, message: "Only active relationships can be ended." };
    }
  } else if (status === "active" || status === "declined") {
    if (relationship.status !== "pending" || relationship.initiated_by !== "coach") {
      return {
        ok: false,
        message: "Only pending coach requests can be accepted or declined.",
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
    query = query.eq("status", "pending").eq("initiated_by", "coach");
  }

  const { data, error } = await query.select("id").maybeSingle();
  if (error || !data) {
    return {
      ok: false,
      message: coachVenueMutationErrorMessage(error, "The relationship could not be updated."),
    };
  }

  revalidateVenueCoachPaths(relationship.coach_id, relationship.venue_id);
  const { notifyCoachVenueRelationship } = await import(
    "@/lib/notifications/notifyRelationship"
  );
  void notifyCoachVenueRelationship({
    kind: status === "active" ? "accepted" : status,
    coachId: relationship.coach_id,
    venueId: relationship.venue_id,
    recipient: "coach",
  });
  return { ok: true, message: successMessage };
}
