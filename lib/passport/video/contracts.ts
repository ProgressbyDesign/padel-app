import type { AssessmentOrder, VideoSubmissionAttempt } from "../types";

// A browser-safe projection. Never send payment references or worker credentials.
export type SubmissionOrder = Pick<AssessmentOrder, "id" | "skill_id" | "state" | "payment_state" | "refund_state" | "terms_snapshot" | "review_due_at" | "created_at">;
export type SubmissionAttempt = Pick<VideoSubmissionAttempt, "id" | "attempt_number" | "upload_state" | "validation_state" | "recording_guidance" | "failure_reason">;
export type SubmissionRecord = { order: SubmissionOrder; attempt: SubmissionAttempt | null; skillTitle: string };

/** Future Stream adapter reserves a durable intent before issuing a short-lived
 * resumable upload capability. Clients never supply provider IDs or readiness. */
export interface VideoUploadProvider {
  upload(input: { orderId: string; requestId: string; file: File; signal: AbortSignal; onProgress: (percent: number) => void; onProcessing: () => void }): Promise<void>;
}

export function canSubmit(order: SubmissionOrder, attempt: SubmissionAttempt | null): boolean {
  return order.payment_state === "paid" && order.refund_state === "none" && (
    order.state === "awaiting_submission" || order.state === "replacement_requested" ||
    (order.state === "processing" && !!attempt && ["awaiting_upload", "uploaded", "processing"].includes(attempt.upload_state))
  );
}

export const assessmentStatus: Record<SubmissionOrder["state"], string> = {
  awaiting_payment: "Awaiting payment", awaiting_submission: "Ready to upload", processing: "Upload in progress",
  ready_for_review: "Ready for your assessor", in_review: "Your assessor is reviewing", replacement_requested: "Replacement requested",
  completed: "Assessment delivered", cancelled: "Cancelled",
};
