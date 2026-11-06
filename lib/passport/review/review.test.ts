import { describe, expect, it } from "vitest";
import { nextRecommendations, reviewable, reviewTiming, type ReviewDetail, type ReviewOrder } from "./model";
import { validateReview, type ReviewInput } from "./validation";
import { previewAssessmentNotification, notificationCopy, type NotificationIntent } from "./notifications";

const order: ReviewOrder = { id: "d0000000-0000-4000-8000-000000000001", skill_id: "improver-bandeja", standard_id: "rubric", player_id: "player", purchased_coach_id: "coach", assessor_user_id: "assessor", parent_order_id: null, active_attempt_id: null, created_at: "2026-11-01T12:00:00Z", completed_at: null, review_due_at: null, state: "ready_for_review", payment_state: "paid", refund_state: "none", terms_snapshot: { standard_version: 1, policy_version: 1, terms: "Synthetic test terms", review_target_hours: 72, replacement_clock: "reset", max_video_seconds: 90, evidence_requirements: { camera: "Full body", repetitions: "Five feeds", max_seconds: 90 }, criteria: [{ id: "contact", expectation: "Controlled contact" }, { id: "position", expectation: "Ready position" }] } };
const input: ReviewInput = { requestId: "d0000000-0000-4000-8000-000000000002", outcome: "developing", observations: "The player holds a stable ready position.", positive_feedback: "Good preparation before contact.", areas_for_improvement: "Keep the contact point in front.", recommendations: "Shorten the backswing to retain control.", practice_tasks: "Ten controlled partner feeds to a marked target.", next_step: "Practise controlled feeds before reassessment.", criteria_results: { contact: false, position: true }, replacement_reason: "Incorrect camera angle", recording_guidance: "Film behind the baseline with contact visible." };
describe("structured coach assessment", () => {
  it("maps Developing feedback to the existing command without payment or verification fields", () => {
    const result = validateReview(input, order);
    expect(result).toMatchObject({ order_id: order.id, outcome: "developing", practice_tasks: [input.practice_tasks] });
    expect(result).not.toHaveProperty("payment_state"); expect(result).not.toHaveProperty("response_video_reference");
    expect("areas_for_improvement" in result && result.areas_for_improvement).toContain("Technical recommendations:");
  });
  it("allows Verified only when all purchased criteria are explicitly met", () => {
    expect(() => validateReview({ ...input, outcome: "verified" }, order)).toThrow("all criteria");
    expect(validateReview({ ...input, outcome: "verified", criteria_results: { contact: true, position: true } }, order).outcome).toBe("verified");
  });
  it("requires an unmet criterion for Developing", () => expect(() => validateReview({ ...input, criteria_results: { contact: true, position: true } }, order)).toThrow("unmet"));
  it.each(["observations", "positive_feedback", "recommendations", "practice_tasks", "next_step", "areas_for_improvement"])("rejects incomplete %s", (field) => expect(() => validateReview({ ...input, [field]: "short" }, order)).toThrow());
  it.each([{ contact: true }, { contact: true, position: "false" }, { contact: false, position: true, injected: true }])("rejects incomplete or forged criterion verdicts", criteria_results => expect(() => validateReview({ ...input, criteria_results } as ReviewInput, order)).toThrow("every criterion"));
  it("requires a predefined recording issue and actionable guidance for free replacement", () => {
    const result = validateReview({ ...input, outcome: "replacement_requested" }, order);
    expect(result).toEqual({ order_id: order.id, outcome: "replacement_requested", observations: input.observations, replacement_reason: input.replacement_reason, recording_guidance: input.recording_guidance });
    expect(() => validateReview({ ...input, outcome: "replacement_requested", recording_guidance: "" }, order)).toThrow();
    expect(() => validateReview({ ...input, outcome: "replacement_requested", replacement_reason: "Other" }, order)).toThrow();
  });
  it("never makes processing, refunded or cancelled evidence reviewable", () => {
    const attempt = { upload_state: "ready", validation_state: "valid" } as ReviewDetail["attempts"][number];
    expect(reviewable(order, attempt)).toBe(true);
    for (const row of [{ ...order, state: "cancelled" }, { ...order, refund_state: "requested" }, { ...order, payment_state: "pending" }]) expect(reviewable(row as ReviewOrder, attempt)).toBe(false);
    expect(reviewable(order, { ...attempt, upload_state: "processing" })).toBe(false);
  });
  it("calculates UTC instants and pauses replacement/completed clocks", () => {
    const now = Date.parse("2026-11-03T12:00:00Z");
    expect(reviewTiming({ state: "in_review", review_due_at: "2026-11-03T14:00:00+02:00" }, now).label).toBe("Due now");
    expect(reviewTiming({ state: "ready_for_review", review_due_at: "2026-11-03T10:00:00Z" }, now).overdue).toBe(true);
    expect(reviewTiming({ state: "replacement_requested", review_due_at: null }, now).label).toContain("paused");
    expect(reviewTiming({ state: "completed", review_due_at: "2026-11-01T00:00:00Z" }, now).overdue).toBe(false);
  });
  it("uses latest final feedback per skill, leaving replacement requests out of practice recommendations", () => {
    const record = { order, reviews: [{ id: "old", outcome: "verified", reviewed_at: "2026-11-01" }, { id: "new", outcome: "developing", reviewed_at: "2026-11-02" }, { id: "replacement", outcome: "replacement_requested", reviewed_at: "2026-11-03" }] } as ReviewDetail;
    expect(nextRecommendations([record]).map(row => row.review.id)).toEqual(["new"]);
  });
});
describe("notification preparation without delivery", () => {
  it.each(Object.keys(notificationCopy))("previews %s with the existing branded template and a stable idempotency key", kind => {
    const event = { id: "synthetic-intent", order_id: order.id, kind } as NotificationIntent;
    const preview = previewAssessmentNotification(event, "http://127.0.0.1:3107");
    expect(preview.delivery).toBe("preview_only"); expect(preview.from).toContain("hello@padelpathways.com");
    expect(preview.html).toContain("padelpathways-logo-email.png"); expect(preview.html).not.toContain("provider_reference");
    expect(previewAssessmentNotification(event, "http://127.0.0.1:3107").idempotencyKey).toBe(preview.idempotencyKey);
  });
  it("refuses a hosted email preview destination", () => expect(() => previewAssessmentNotification({ kind: "skill_verified" } as NotificationIntent, "https://padelpathways.com")).toThrow("isolated"));
});
