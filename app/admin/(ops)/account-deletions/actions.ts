"use server";

import { revalidatePath } from "next/cache";
import { requireAdminAccount } from "@/lib/auth/adminSession";
import type { DeletionActionResult } from "@/lib/accountDeletion/types";
import {
  sendDeletionCancelledEmail,
  sendDeletionDeclinedEmail,
  sendDeletionProcessingEmail,
} from "@/lib/notifications/deletionEmails";
import { adminUpdateDeletionRequestStatus } from "@/lib/queries/accountDeletionRequests";

function revalidateAdminDeletion(requestId?: string) {
  revalidatePath("/admin/account-deletions");
  revalidatePath("/account/settings");
  if (requestId) {
    revalidatePath(`/admin/account-deletions/${requestId}`);
  }
}

async function authorizeAdmin() {
  return requireAdminAccount("not-found");
}

export async function markProcessing(
  requestId: string
): Promise<DeletionActionResult> {
  await authorizeAdmin();
  const result = await adminUpdateDeletionRequestStatus({
    requestId,
    status: "processing",
  });
  if ("error" in result) {
    return {
      ok: false,
      message: "Unable to mark this request as processing.",
    };
  }

  revalidateAdminDeletion(requestId);
  void sendDeletionProcessingEmail(result.request.requester_email).catch(
    () => undefined
  );

  return {
    ok: true,
    message:
      "Request marked as processing. This does not delete the Auth user.",
  };
}

export async function declineDeletionRequest(
  requestId: string
): Promise<DeletionActionResult> {
  await authorizeAdmin();
  const result = await adminUpdateDeletionRequestStatus({
    requestId,
    status: "declined",
  });
  if ("error" in result) {
    return { ok: false, message: "Unable to decline this request." };
  }

  revalidateAdminDeletion(requestId);
  void sendDeletionDeclinedEmail(result.request.requester_email).catch(
    () => undefined
  );

  return { ok: true, message: "Deletion request declined." };
}

export async function operationalCancel(
  requestId: string
): Promise<DeletionActionResult> {
  await authorizeAdmin();
  const result = await adminUpdateDeletionRequestStatus({
    requestId,
    status: "cancelled",
  });
  if ("error" in result) {
    return {
      ok: false,
      message: "Unable to cancel this request operationally.",
    };
  }

  revalidateAdminDeletion(requestId);
  void sendDeletionCancelledEmail(result.request.requester_email).catch(
    () => undefined
  );

  return { ok: true, message: "Deletion request cancelled operationally." };
}
