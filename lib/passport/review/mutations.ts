import "server-only";
import { runPassportCommand } from "../operations";
import { loadReviewDetail } from "./queries";
import { reviewable } from "./model";
import { validId } from "./access";
import { validateReview, type ReviewInput } from "./validation";

export async function reviewMutation(coachId: string, orderId: string, command: "start_review" | "submit_review", input: ReviewInput) {
  if (!validId(coachId) || !validId(orderId) || !validId(input?.requestId)) throw new Error("Refresh this assessment before continuing.");
  const record = await loadReviewDetail(orderId, coachId);
  if (!record) throw new Error("This assessment is unavailable or your permission has changed.");
  // Preserve exact request ID/payload on uncertain retries. The domain RPC checks
  // idempotency before lifecycle state, so a committed lost-response can replay.
  if (!reviewable(record.order, record.attempts.find(item => item.id === record.order.active_attempt_id) ?? null) && !record.reviews.length) throw new Error("Playable, paid evidence is required before review.");
  return command === "submit_review"
    ? runPassportCommand("submit_review", validateReview(input, record.order), input.requestId)
    : runPassportCommand("start_review", { order_id: orderId }, input.requestId);
}
