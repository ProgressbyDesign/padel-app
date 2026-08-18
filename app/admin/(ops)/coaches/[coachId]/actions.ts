"use server";

import { revalidatePath } from "next/cache";
import { writeAdminAuditEvent } from "@/lib/admin/audit";
import { requireAdminPermission } from "@/lib/auth/adminSession";
import {
  canPublishForLaunch,
  launchSelectionAdminLabel,
  publicationAdminLabel,
  type LifecycleActionResult,
} from "@/lib/lifecycle/adminStatus";
import type {
  LaunchSelectionStatus,
  PublicationStatus,
} from "@/lib/lifecycle/constants";
import { isValidCoachId } from "@/lib/queries/managedCoachShell";
import { createClient } from "@/lib/supabase/server";

async function authorizeLifecycleAction() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || typeof data?.claims?.sub !== "string") {
    throw new Error("Your admin session has expired.");
  }
  return requireAdminPermission("profiles.manage", "not-found");
}

function revalidateCoachLifecycle(coachId: string) {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/admin/coaches/${coachId}`);
  revalidatePath("/coaches");
  revalidatePath(`/coach/${coachId}`);
  revalidatePath("/account");
  revalidatePath(`/account/coaches/${coachId}`);
}

function lifecycleErrorMessage(
  message: string | undefined,
  fallback: string
): string {
  const text = (message ?? "").toLowerCase();
  if (text.includes("profiles.manage") || text.includes("administrators")) {
    return "Only administrators with profile management permission can change launch or visibility.";
  }
  if (text.includes("row-level security") || text.includes("permission denied")) {
    return "This change was rejected by database permissions.";
  }
  return fallback;
}

/**
 * Writes a single lifecycle column with the authenticated admin client so the
 * database trigger performs the permission check and fills the audit fields
 * (selected_at / selected_by_user_id / published_at / published_by_user_id).
 */
async function updateCoachLifecycle(
  coachId: string,
  patch:
    | { launch_selection_status: LaunchSelectionStatus }
    | { publication_status: PublicationStatus },
  successMessage: string,
  failureMessage: string
): Promise<LifecycleActionResult> {
  await authorizeLifecycleAction();
  if (!isValidCoachId(coachId)) {
    return { ok: false, message: "That coach could not be found." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coaches")
    .update(patch)
    .eq("id", coachId)
    .select("id, launch_selection_status, publication_status")
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      message: lifecycleErrorMessage(error?.message, failureMessage),
    };
  }

  revalidateCoachLifecycle(coachId);
  void writeAdminAuditEvent({
    action: "profile.admin_updated",
    targetType: "coach",
    targetId: coachId,
    details: {
      launchSelectionStatus: launchSelectionAdminLabel(
        data.launch_selection_status
      ),
      publicationStatus: publicationAdminLabel(data.publication_status),
    },
  }).catch(() => undefined);

  return { ok: true, message: successMessage };
}

export async function adminSelectCoachForLaunch(
  coachId: string
): Promise<LifecycleActionResult> {
  return updateCoachLifecycle(
    coachId,
    { launch_selection_status: "selected" },
    "Coach selected for launch. Publish separately to make the profile public.",
    "The coach could not be selected for launch."
  );
}

export async function adminUnselectCoachForLaunch(
  coachId: string
): Promise<LifecycleActionResult> {
  return updateCoachLifecycle(
    coachId,
    { launch_selection_status: "unselected" },
    "Coach removed from the launch selection.",
    "The launch selection could not be cleared."
  );
}

export async function adminExcludeCoachFromLaunch(
  coachId: string
): Promise<LifecycleActionResult> {
  return updateCoachLifecycle(
    coachId,
    { launch_selection_status: "excluded" },
    "Coach excluded from launch.",
    "The coach could not be excluded."
  );
}

export async function adminPublishCoach(
  coachId: string
): Promise<LifecycleActionResult> {
  await authorizeLifecycleAction();
  if (!isValidCoachId(coachId)) {
    return { ok: false, message: "That coach could not be found." };
  }

  const supabase = await createClient();
  const { data: coach, error: readError } = await supabase
    .from("coaches")
    .select("id, launch_selection_status")
    .eq("id", coachId)
    .maybeSingle();
  if (readError || !coach) {
    return { ok: false, message: "That coach could not be found." };
  }

  // Publishing never auto-selects: the two states must stay independent.
  if (!canPublishForLaunch(coach.launch_selection_status)) {
    return {
      ok: false,
      message:
        "Select this coach for launch first. Publishing is only available for selected coaches.",
    };
  }

  return updateCoachLifecycle(
    coachId,
    { publication_status: "published" },
    "Coach published. The profile is now publicly visible.",
    "The coach could not be published."
  );
}

export async function adminMakeCoachPrivate(
  coachId: string
): Promise<LifecycleActionResult> {
  return updateCoachLifecycle(
    coachId,
    { publication_status: "private" },
    "Coach is private again and no longer publicly visible.",
    "The coach could not be made private."
  );
}

export async function adminSuspendCoach(
  coachId: string
): Promise<LifecycleActionResult> {
  return updateCoachLifecycle(
    coachId,
    { publication_status: "suspended" },
    "Coach suspended and removed from public surfaces.",
    "The coach could not be suspended."
  );
}
