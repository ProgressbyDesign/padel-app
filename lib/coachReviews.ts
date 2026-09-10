export const REVIEW_AREAS = [
  { key: "coaching_quality", label: "Coaching quality", description: "Clear instruction, useful feedback and a session suited to your level." },
  { key: "player_progress", label: "Player progress", description: "What you learned and how the session helped your game." },
  { key: "value_for_money", label: "Value for money", description: "How the coaching experience matched the price you paid." },
] as const;

export type ReviewArea = (typeof REVIEW_AREAS)[number]["key"];
export type ReviewScores = Record<ReviewArea, number>;
export type CoachReview = ReviewScores & {
  id: string;
  coach_id: string;
  body: string;
  created_at: string;
  overall_rating: number;
};
export type CoachReviewSummary = {
  review_count: number;
  rating: number | null;
  coaching_quality: number | null;
  player_progress: number | null;
  value_for_money: number | null;
};
export type CoachReviewsData = {
  available: boolean;
  summary: CoachReviewSummary;
  reviews: CoachReview[];
};

export const EMPTY_REVIEW_SUMMARY: CoachReviewSummary = {
  review_count: 0, rating: null, coaching_quality: null, player_progress: null, value_for_money: null,
};

export function validateReviewInput(input: unknown): { ok: true; bookingId: string; scores: ReviewScores; body: string } | { ok: false; message: string } {
  if (!input || typeof input !== "object") return { ok: false, message: "Enter your session ratings." };
  const value = input as Record<string, unknown>;
  if (typeof value.bookingId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.bookingId)) {
    return { ok: false, message: "Choose a completed booking to review." };
  }
  const scores = {} as ReviewScores;
  for (const area of REVIEW_AREAS) {
    const score = value[area.key];
    if (typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > 5) {
      return { ok: false, message: `Rate ${area.label.toLowerCase()} from 1 to 5 stars.` };
    }
    scores[area.key] = score;
  }
  if (typeof value.body !== "string" || value.body.length > 2000) return { ok: false, message: "Keep your written review within 2,000 characters." };
  return { ok: true, bookingId: value.bookingId, scores, body: value.body.trim() };
}

export function canReviewBooking(booking: { status: string; requester_user_id: string; ends_at: string }, userId: string, now = Date.now()): boolean {
  return booking.requester_user_id === userId && booking.status === "completed" && new Date(booking.ends_at).getTime() <= now;
}
