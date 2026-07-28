"use server";

import { revalidatePath } from "next/cache";
import { requireAdminPermission } from "@/lib/auth/adminSession";
import { writeAdminAuditEvent } from "@/lib/admin/audit";
import { coachVenueMutationErrorMessage } from "@/lib/coachVenues/errors";
import type { RelationshipActionResult } from "@/lib/coachVenues/types";
import {
  searchAdminCoachesForRelationship,
  searchAdminVenuesForRelationship,
} from "@/lib/admin/relationshipQueries";
import { loadCoachVenueById } from "@/lib/queries/coachVenueRelationships";
import { isValidCoachId } from "@/lib/queries/managedCoachShell";
import { isValidVenueId } from "@/lib/queries/managedVenueShell";
import { createClient } from "@/lib/supabase/server";

async function authorizeAdmin() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || typeof data?.claims?.sub !== "string") {
    throw new Error("Your admin session has expired.");
  }
  return requireAdminPermission("relationships.manage", "not-found");
}

function revalidateRelationship(coachId: string, venueId: string) {
  revalidatePath("/admin/relationships");
  revalidatePath("/account");
  revalidatePath(`/account/coaches/${coachId}`);
  revalidatePath(`/account/coaches/${coachId}/venues`);
  revalidatePath(`/account/venues/${venueId}`);
  revalidatePath(`/account/venues/${venueId}/coaches`);
  revalidatePath(`/coach/${coachId}`);
  revalidatePath(`/venue/${venueId}`);
}

async function updateStatus(
  relationshipId: string,
  status: "active" | "declined" | "cancelled" | "ended",
  successMessage: string,
  expected?: { status?: string | string[]; initiatedBy?: string }
): Promise<RelationshipActionResult> {
  await authorizeAdmin();
  const relationship = await loadCoachVenueById(relationshipId);
  if (!relationship) return { ok: false, message: "Relationship not found." };

  const supabase = await createClient();
  let query = supabase
    .from("coach_venues")
    .update({ status })
    .eq("id", relationshipId);

  if (expected?.status) {
    if (Array.isArray(expected.status)) {
      query = query.in("status", expected.status);
    } else {
      query = query.eq("status", expected.status);
    }
  }
  if (expected?.initiatedBy) {
    query = query.eq("initiated_by", expected.initiatedBy);
  }

  const { data, error } = await query.select("id").maybeSingle();
  if (error || !data) {
    return {
      ok: false,
      message: coachVenueMutationErrorMessage(
        error,
        "The relationship could not be updated."
      ),
    };
  }

  revalidateRelationship(relationship.coach_id, relationship.venue_id);
  if (status === "active") {
    void writeAdminAuditEvent({
      action: "relationship.activated",
      targetType: "coach_venue",
      targetId: relationshipId,
      details: {
        coachId: relationship.coach_id,
        venueId: relationship.venue_id,
      },
    }).catch(() => undefined);
  } else if (status === "ended") {
    void writeAdminAuditEvent({
      action: "relationship.ended",
      targetType: "coach_venue",
      targetId: relationshipId,
      details: {
        coachId: relationship.coach_id,
        venueId: relationship.venue_id,
      },
    }).catch(() => undefined);
  }
  return { ok: true, message: successMessage };
}

export async function adminApproveCoachVenueRelationship(
  relationshipId: string
): Promise<RelationshipActionResult> {
  return updateStatus(relationshipId, "active", "Relationship approved.", {
    status: "pending",
  });
}

export async function adminDeclineCoachVenueRelationship(
  relationshipId: string
): Promise<RelationshipActionResult> {
  return updateStatus(relationshipId, "declined", "Relationship declined.", {
    status: "pending",
  });
}

export async function adminCancelCoachVenueRelationship(
  relationshipId: string
): Promise<RelationshipActionResult> {
  return updateStatus(relationshipId, "cancelled", "Relationship cancelled.", {
    status: "pending",
  });
}

export async function adminVerifyImportedCoachVenueRelationship(
  relationshipId: string
): Promise<RelationshipActionResult> {
  return updateStatus(relationshipId, "active", "Imported relationship verified.", {
    status: "unverified",
    initiatedBy: "import",
  });
}

export async function adminRemoveImportedCoachVenueRelationship(
  relationshipId: string
): Promise<RelationshipActionResult> {
  return updateStatus(
    relationshipId,
    "cancelled",
    "Imported relationship removed.",
    {
      status: "unverified",
      initiatedBy: "import",
    }
  );
}

export async function adminEndCoachVenueRelationship(
  relationshipId: string
): Promise<RelationshipActionResult> {
  return updateStatus(relationshipId, "ended", "Relationship ended.", {
    status: "active",
  });
}

export async function adminSetPrimaryCoachVenue(
  relationshipId: string,
  isPrimary: boolean
): Promise<RelationshipActionResult> {
  await authorizeAdmin();
  const relationship = await loadCoachVenueById(relationshipId);
  if (!relationship) return { ok: false, message: "Relationship not found." };

  if (relationship.status !== "active" && relationship.status !== "unverified") {
    return {
      ok: false,
      message: "Only active or imported relationships can be primary.",
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
    .in("status", ["active", "unverified"])
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      message: coachVenueMutationErrorMessage(
        error,
        "Primary state could not be updated."
      ),
    };
  }

  revalidateRelationship(relationship.coach_id, relationship.venue_id);
  return {
    ok: true,
    message: isPrimary ? "Primary venue set." : "Primary venue cleared.",
  };
}

export async function adminCreateCoachVenueRelationship(input: {
  coachId: string;
  venueId: string;
  mode: "active" | "imported";
  isPrimary?: boolean;
}): Promise<RelationshipActionResult> {
  await authorizeAdmin();
  if (!isValidCoachId(input.coachId) || !isValidVenueId(input.venueId)) {
    return { ok: false, message: "Select a valid coach and venue." };
  }

  const supabase = await createClient();
  const [{ data: coach }, { data: venue }] = await Promise.all([
    supabase.from("coaches").select("id").eq("id", input.coachId).maybeSingle(),
    supabase.from("venues").select("id").eq("id", input.venueId).maybeSingle(),
  ]);
  if (!coach || !venue) {
    return { ok: false, message: "Coach or venue was not found." };
  }

  const payload =
    input.mode === "active"
      ? {
          coach_id: input.coachId,
          venue_id: input.venueId,
          initiated_by: "admin" as const,
          status: "active" as const,
          is_primary: Boolean(input.isPrimary),
        }
      : {
          coach_id: input.coachId,
          venue_id: input.venueId,
          initiated_by: "import" as const,
          status: "unverified" as const,
          is_primary: Boolean(input.isPrimary),
        };

  const { error } = await supabase.from("coach_venues").insert(payload);
  if (error) {
    return { ok: false, message: coachVenueMutationErrorMessage(error) };
  }

  revalidateRelationship(input.coachId, input.venueId);
  void writeAdminAuditEvent({
    action: "relationship.created",
    targetType: "coach_venue",
    targetId: null,
    details: {
      coachId: input.coachId,
      venueId: input.venueId,
      mode: input.mode,
    },
  }).catch(() => undefined);
  return {
    ok: true,
    message:
      input.mode === "active"
        ? "Active relationship created."
        : "Imported relationship created.",
  };
}

export async function searchAdminCoachesForRelationshipAction(term: string) {
  await authorizeAdmin();
  try {
    return { ok: true as const, results: await searchAdminCoachesForRelationship(term) };
  } catch {
    return { ok: false as const, message: "Coach search failed." };
  }
}

export async function searchAdminVenuesForRelationshipAction(term: string) {
  await authorizeAdmin();
  try {
    return { ok: true as const, results: await searchAdminVenuesForRelationship(term) };
  } catch {
    return { ok: false as const, message: "Venue search failed." };
  }
}
