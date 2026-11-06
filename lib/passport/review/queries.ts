import "server-only";
import { reviewClient, reviewExperienceEnabled, validId } from "./access";
import type { CoachReview, PassportVerification } from "../types";
import type { ReviewContext, ReviewDetail, ReviewOrder, ReviewAttempt, ReviewSummary } from "./model";

const orderFields = "id,skill_id,standard_id,player_id,purchased_coach_id,assessor_user_id,parent_order_id,active_attempt_id,terms_snapshot,state,payment_state,refund_state,created_at,review_due_at,completed_at";
const attemptFields = "id,order_id,attempt_number,provider,upload_state,validation_state,duration_seconds,bytes,mime_type,failure_reason,recording_guidance,created_at,upload_completed_at,processing_completed_at,available_at,submitted_at,review_started_at";
export async function loadReviewSummaries(coachId?: string): Promise<ReviewSummary[]> {
  if (!reviewExperienceEnabled()) return [];
  if (coachId && !validId(coachId)) return [];
  const { client, userId } = await reviewClient();
  let query = client.from("pp_orders").select(orderFields).order("created_at", { ascending: false }).limit(100);
  query = coachId ? query.eq("purchased_coach_id", coachId).eq("assessor_user_id", userId) : query.eq("player_id", userId);
  const orders = await query;
  if (orders.error) throw new Error("Assessment records could not be loaded.");
  const rows = (orders.data ?? []) as ReviewOrder[];
  if (!rows.length) return [];
  const ids = rows.map(row => row.id);
  const [contexts, attempts, reviews] = await Promise.all([
    client.rpc("passport_review_context", { p_orders: ids }),
    client.from("pp_submission_attempts").select("id,order_id,submitted_at").in("order_id", ids),
    client.from("pp_reviews").select("order_id,outcome").in("order_id", ids).eq("outcome", "replacement_requested"),
  ]);
  if (contexts.error || attempts.error || reviews.error) throw new Error("Assessment records could not be loaded.");
  return rows.flatMap(order => {
    const context = (contexts.data as ReviewContext[]).find(item => item.order_id === order.id);
    return context ? [{ order, context, submittedAt: attempts.data?.find(item => item.id === order.active_attempt_id)?.submitted_at ?? null, replacementCount: reviews.data?.filter(item => item.order_id === order.id).length ?? 0 }] : [];
  });
}
export async function loadReviewDetail(orderId: string, coachId?: string): Promise<ReviewDetail | null> {
  if (!reviewExperienceEnabled() || !validId(orderId) || (coachId && !validId(coachId))) return null;
  const { client, userId } = await reviewClient();
  let query = client.from("pp_orders").select(orderFields).eq("id", orderId);
  query = coachId ? query.eq("purchased_coach_id", coachId).eq("assessor_user_id", userId) : query.eq("player_id", userId);
  const response = await query.maybeSingle();
  if (response.error) throw new Error("Assessment records could not be loaded.");
  if (!response.data) return null;
  const order = response.data as ReviewOrder;
  const [contexts, attempts, reviews, verifications] = await Promise.all([
    client.rpc("passport_review_context", { p_orders: [orderId] }),
    client.from("pp_submission_attempts").select(attemptFields).eq("order_id", orderId).order("attempt_number", { ascending: false }),
    client.from("pp_reviews").select("*").eq("order_id", orderId).order("sequence", { ascending: false }),
    client.from("pp_skill_verifications").select("*").eq("order_id", orderId),
  ]);
  if (contexts.error || attempts.error || reviews.error || verifications.error) throw new Error("Assessment records could not be loaded.");
  const context = (contexts.data as ReviewContext[])[0];
  if (!context) return null;
  let previous: ReviewDetail["previous"] = null;
  if (order.parent_order_id) {
    // Access to a new assignment never grants access to a previous coach's order.
    const parent = await client.from("pp_orders").select("id").eq("id", order.parent_order_id).eq("player_id", order.player_id).maybeSingle();
    if (parent.error) throw new Error("Assessment history could not be loaded.");
    if (parent.data) {
      const history = await client.from("pp_reviews").select("*").eq("order_id", parent.data.id).order("sequence", { ascending: false });
      if (history.error) throw new Error("Assessment history could not be loaded.");
      previous = { id: parent.data.id, reviews: history.data as CoachReview[] };
    }
  }
  const history = attempts.data as ReviewAttempt[], decisions = reviews.data as CoachReview[];
  return { order, context, attempts: history, reviews: decisions, verifications: verifications.data as PassportVerification[], previous, viewer: coachId ? "assessor" : "player", submittedAt: history.find(item => item.id === order.active_attempt_id)?.submitted_at ?? null, replacementCount: decisions.filter(item => item.outcome === "replacement_requested").length };
}
export async function loadPlayerReviewDetails(): Promise<ReviewDetail[]> {
  const summaries = await loadReviewSummaries();
  if (!summaries.length) return [];
  const { client } = await reviewClient(), ids = summaries.map(item => item.order.id);
  const [attempts, reviews, verifications] = await Promise.all([
    client.from("pp_submission_attempts").select(attemptFields).in("order_id", ids).order("attempt_number", { ascending: false }),
    client.from("pp_reviews").select("*").in("order_id", ids).order("sequence", { ascending: false }),
    client.from("pp_skill_verifications").select("*").in("order_id", ids),
  ]);
  if (attempts.error || reviews.error || verifications.error) throw new Error("Your assessment history could not be loaded.");
  return summaries.map(summary => ({ ...summary, viewer: "player", previous: null,
    attempts: (attempts.data as ReviewAttempt[]).filter(item => item.order_id === summary.order.id),
    reviews: (reviews.data as CoachReview[]).filter(item => item.order_id === summary.order.id),
    verifications: (verifications.data as PassportVerification[]).filter(item => item.order_id === summary.order.id),
  }));
}
