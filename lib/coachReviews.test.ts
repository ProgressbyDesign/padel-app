import { describe, expect, it } from "vitest";
import { canReviewBooking, validateReviewInput } from "./coachReviews";

const input = { bookingId: "11111111-1111-4111-8111-111111111111", coaching_quality: 5, player_progress: 4, value_for_money: 3, body: " Helpful feedback. " };
describe("verified coach reviews", () => {
  it("requires the booking owner and a completed session in the past", () => {
    const booking = { requester_user_id: "player", status: "completed", ends_at: "2026-01-01T10:00:00Z" };
    const now = Date.parse("2026-02-01T00:00:00Z");
    expect(canReviewBooking(booking, "player", now)).toBe(true);
    expect(canReviewBooking(booking, "other", now)).toBe(false);
    for (const status of ["requested", "accepted", "cancelled", "declined"]) expect(canReviewBooking({ ...booking, status }, "player", now)).toBe(false);
    expect(canReviewBooking({ ...booking, ends_at: "2027-01-01" }, "player", now)).toBe(false);
    expect(canReviewBooking({ ...booking, ends_at: "invalid" }, "player", now)).toBe(false);
  });
  it("accepts all three scores and trims an optional comment", () => {
    expect(validateReviewInput(input)).toEqual({ ok: true, bookingId: input.bookingId, scores: { coaching_quality: 5, player_progress: 4, value_for_money: 3 }, body: "Helpful feedback." });
    expect(validateReviewInput({ ...input, body: "" }).ok).toBe(true);
  });
  it("rejects malformed input, invalid scores and oversized comments", () => {
    for (const invalid of [null, {}, { ...input, bookingId: "bad" }, { ...input, body: "a".repeat(2001) }]) expect(validateReviewInput(invalid).ok).toBe(false);
    for (const key of ["coaching_quality", "player_progress", "value_for_money"]) for (const score of [0, 6, 2.5, "5", NaN, undefined]) expect(validateReviewInput({ ...input, [key]: score }).ok).toBe(false);
  });
});
