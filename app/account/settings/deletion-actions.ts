"use server";

import { revalidatePath } from "next/cache";
import type { DeletionActionResult } from "@/lib/accountDeletion/types";
import {
  normalizeDeletionReason,
  validateDeletionConfirmation,
  validateDeletionReasonLength,
} from "@/lib/accountDeletion/validation";
import {
  sendDeletionCancelledEmail,
  sendDeletionOpsSubmittedEmail,
  sendDeletionSubmittedEmail,
} from "@/lib/notifications/deletionEmails";
import {
  cancelDeletionRequest,
  createDeletionRequest,
  loadDeletionResponsibilitySummary,
  loadOwnDeletionRequest,
} from "@/lib/queries/accountDeletionRequests";
import { createClient } from "@/lib/supabase/server";

function revalidateDeletionPaths() {
  revalidatePath("/account/settings");
  revalidatePath("/admin/account-deletions");
}

async function requireUserClaims(): Promise<{
  userId: string;
  email: string;
} | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string" || !userId) return null;
  const email =
    typeof data?.claims?.email === "string" ? data.claims.email.trim() : "";
  return { userId, email };
}

function mapCreateError(error: { code?: string; message?: string }): string {
  const message = error.message?.toLowerCase() ?? "";
  if (
    error.code === "23505" ||
    message.includes("duplicate") ||
    message.includes("unique") ||
    message.includes("one_open")
  ) {
    return "You already have an open account deletion request.";
  }
  return "We could not submit your deletion request. Please try again shortly.";
}

export async function requestAccountDeletionAction(input: {
  reason?: string | null;
  confirmation: string;
}): Promise<DeletionActionResult> {
  const claims = await requireUserClaims();
  if (!claims) {
    return { ok: false, message: "Please sign in to continue." };
  }

  const confirmationError = validateDeletionConfirmation(input.confirmation);
  const reasonError = validateDeletionReasonLength(input.reason);
  if (confirmationError || reasonError) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: {
        ...(confirmationError ? { confirmation: confirmationError } : {}),
        ...(reasonError ? { reason: reasonError } : {}),
      },
    };
  }

  const existing = await loadOwnDeletionRequest(claims.userId);
  if (
    existing &&
    (existing.status === "requested" || existing.status === "processing")
  ) {
    return {
      ok: false,
      message: "You already have an open account deletion request.",
      fieldErrors: { form: "You already have an open account deletion request." },
    };
  }

  const reason = normalizeDeletionReason(input.reason);
  const result = await createDeletionRequest({
    userId: claims.userId,
    reason,
  });

  if ("error" in result) {
    return { ok: false, message: mapCreateError(result.error) };
  }

  revalidateDeletionPaths();

  const responsibility = await loadDeletionResponsibilitySummary(claims.userId);
  const emailTo = result.request.requester_email || claims.email;
  void sendDeletionSubmittedEmail(emailTo).catch(() => undefined);
  void sendDeletionOpsSubmittedEmail({
    userId: claims.userId,
    requesterEmail: emailTo,
    requestedAt: result.request.requested_at,
    responsibility,
  }).catch(() => undefined);

  return {
    ok: true,
    message:
      "Deletion request received. Our team will review your account responsibilities and contact you before permanent deletion.",
    requestId: result.request.id,
  };
}

export async function cancelAccountDeletionAction(input: {
  requestId: string;
}): Promise<DeletionActionResult> {
  const claims = await requireUserClaims();
  if (!claims) {
    return { ok: false, message: "Please sign in to continue." };
  }

  const requestId = input.requestId?.trim();
  if (!requestId) {
    return { ok: false, message: "Deletion request not found." };
  }

  const result = await cancelDeletionRequest({
    requestId,
    userId: claims.userId,
  });

  if ("error" in result) {
    return {
      ok: false,
      message: "This deletion request can no longer be cancelled.",
    };
  }

  revalidateDeletionPaths();

  const emailTo = result.request.requester_email || claims.email;
  void sendDeletionCancelledEmail(emailTo).catch(() => undefined);

  return {
    ok: true,
    message: "Your account deletion request has been cancelled.",
  };
}
