/** Pure payload builders for account deletion mutations (unit-testable). */

export function buildDeletionInsertPayload(input: {
  userId: string;
  reason: string | null;
}) {
  return {
    user_id: input.userId,
    status: "requested" as const,
    reason: input.reason,
  };
}

export function buildDeletionCancelUpdate() {
  return { status: "cancelled" as const };
}
