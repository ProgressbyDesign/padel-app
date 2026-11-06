import type { AssessmentOrder, CoachReview, PassportVerification, VideoSubmissionAttempt } from "../types";

export type ReviewOrder = Pick<AssessmentOrder, "id" | "skill_id" | "standard_id" | "player_id" | "purchased_coach_id" | "assessor_user_id" | "parent_order_id" | "active_attempt_id" | "terms_snapshot" | "state" | "payment_state" | "refund_state" | "created_at" | "review_due_at" | "completed_at">;
export type ReviewAttempt = Omit<VideoSubmissionAttempt, "provider_reference">;
export type ReviewContext = { order_id: string; player_name: string; assessor_name: string; coach_name: string; skill_title: string; pathway_title: string; standard_status: "draft" | "published" | "retired"; player_notes: string; review_assessors: Record<string, string> };
export type ReviewSummary = { order: ReviewOrder; context: ReviewContext; submittedAt: string | null; replacementCount: number };
export type ReviewDetail = ReviewSummary & { attempts: ReviewAttempt[]; reviews: CoachReview[]; verifications: PassportVerification[]; previous: { id: string; reviews: CoachReview[] } | null; viewer: "player" | "assessor" };

export const reviewLabels = { awaiting_payment: "Awaiting payment", awaiting_submission: "Awaiting video", processing: "Video processing", ready_for_review: "Awaiting review", in_review: "In review", replacement_requested: "Replacement requested", completed: "Assessment delivered", cancelled: "Cancelled" } as const;
export const outcomeLabels = { developing: "Developing", verified: "Verified", replacement_requested: "Replacement requested" } as const;
export function reviewTiming(order: Pick<ReviewOrder, "state" | "review_due_at">, now = Date.now()) {
  if (!["ready_for_review", "in_review"].includes(order.state) || !order.review_due_at) return { label: order.state === "replacement_requested" ? "Clock paused for replacement" : "No active review deadline", overdue: false, approaching: false };
  const remaining = Date.parse(order.review_due_at) - now;
  if (!Number.isFinite(remaining)) return { label: "Deadline unavailable", overdue: false, approaching: false };
  const absolute = Math.abs(remaining), duration = absolute < 3600000 ? `${Math.max(1, Math.ceil(absolute / 60000))}m` : `${Math.ceil(absolute / 3600000)}h`;
  return { label: remaining === 0 ? "Due now" : remaining < 0 ? `Overdue by ${duration}` : `${duration} remaining`, overdue: remaining < 0, approaching: remaining >= 0 && remaining <= 24 * 3600000 };
}
export function reviewable(order: ReviewOrder, attempt: ReviewAttempt | null): boolean {
  return order.payment_state === "paid" && order.refund_state === "none" && ["ready_for_review", "in_review"].includes(order.state) && !!attempt && attempt.upload_state === "ready" && attempt.validation_state === "valid";
}
export const replacementReasons = ["Incorrect camera angle", "Player not visible", "Wrong skill recorded", "Insufficient repetitions", "Evidence too unclear"] as const;

export function nextRecommendations(records: ReviewDetail[]) {
  // One latest final assessment per skill; older feedback must not override it.
  const latest = new Map<string, { record: ReviewDetail; review: CoachReview }>();
  for (const record of records) for (const review of record.reviews) {
    if (review.outcome === "replacement_requested") continue;
    const prior = latest.get(record.order.skill_id);
    if (!prior || Date.parse(review.reviewed_at) > Date.parse(prior.review.reviewed_at)) latest.set(record.order.skill_id, { record, review });
  }
  return [...latest.values()].sort((a, b) => Date.parse(b.review.reviewed_at) - Date.parse(a.review.reviewed_at));
}
