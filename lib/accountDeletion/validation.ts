import {
  DELETION_CONFIRMATION_TEXT,
  DELETION_REASON_MAX_LENGTH,
} from "@/lib/accountDeletion/types";

export function normalizeDeletionReason(
  reason: string | null | undefined
): string | null {
  if (typeof reason !== "string") return null;
  const trimmed = reason.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, DELETION_REASON_MAX_LENGTH);
}

export function validateDeletionConfirmation(confirmation: string): string | null {
  if (confirmation.trim() !== DELETION_CONFIRMATION_TEXT) {
    return `Type ${DELETION_CONFIRMATION_TEXT} to confirm.`;
  }
  return null;
}

export function validateDeletionReasonLength(
  reason: string | null | undefined
): string | null {
  if (typeof reason !== "string") return null;
  if (reason.trim().length > DELETION_REASON_MAX_LENGTH) {
    return `Reason must be ${DELETION_REASON_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

/** Payload for insert — never includes requester_email (DB snapshots from JWT). */
export function buildDeletionInsertPayload(input: {
  userId: string;
  reason: string | null;
}): {
  user_id: string;
  status: "requested";
  reason: string | null;
} {
  return {
    user_id: input.userId,
    status: "requested",
    reason: input.reason,
  };
}
