import "server-only";
import { createClient } from "@/lib/supabase/server";
import { EMPTY_REVIEW_SUMMARY, type CoachReview, type CoachReviewsData, type CoachReviewSummary } from "@/lib/coachReviews";

const REVIEW_FIELDS = "id, coach_id, coaching_quality, player_progress, value_for_money, overall_rating, body, created_at";

export async function loadCoachReviews(coachId: string): Promise<CoachReviewsData> {
  const supabase = await createClient();
  const [summary, reviews] = await Promise.all([
    supabase.from("coach_review_summaries").select("rating, review_count, coaching_quality, player_progress, value_for_money").eq("coach_id", coachId).maybeSingle(),
    supabase.from("coach_public_reviews").select(REVIEW_FIELDS).eq("coach_id", coachId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(50),
  ]);
  if (summary.error || reviews.error) {
    console.error("[coach-reviews] public read failed", summary.error?.code ?? reviews.error?.code);
    return { available: false, summary: EMPTY_REVIEW_SUMMARY, reviews: [] };
  }
  return { available: true, summary: (summary.data as CoachReviewSummary | null) ?? EMPTY_REVIEW_SUMMARY, reviews: (reviews.data ?? []) as CoachReview[] };
}

export async function loadMyBookingReview(bookingId: string): Promise<{ available: boolean; review: CoachReview | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("coach_reviews").select(REVIEW_FIELDS).eq("booking_id", bookingId).maybeSingle();
  if (error) {
    console.error("[coach-reviews] owner read failed", error.code);
    return { available: false, review: null };
  }
  return { available: true, review: data as CoachReview | null };
}
