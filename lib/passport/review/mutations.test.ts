import { beforeEach, describe, expect, it, vi } from "vitest";
import { reviewMutation } from "./mutations";
import type { ReviewInput } from "./validation";
const mocks = vi.hoisted(() => ({ load: vi.fn(), command: vi.fn() }));
vi.mock("./queries", () => ({ loadReviewDetail: mocks.load }));
vi.mock("../operations", () => ({ runPassportCommand: mocks.command }));
const id = "f1000000-0000-4000-8000-000000000001", requestId = "f1000000-0000-4000-8000-000000000002";
const payload = { requestId, outcome: "replacement_requested", observations: "The contact is outside the camera frame.", replacement_reason: "Incorrect camera angle", recording_guidance: "Film from behind and include your full body." } as ReviewInput;
beforeEach(() => {
  vi.clearAllMocks(); mocks.command.mockResolvedValue({ id });
  mocks.load.mockResolvedValue({ order: { id, state: "ready_for_review", payment_state: "paid", refund_state: "none", active_attempt_id: id }, attempts: [{ id, upload_state: "ready", validation_state: "valid" }], reviews: [] });
});
describe("coach mutation boundary", () => {
  it("preserves exact actor request ID across retries and strips client control fields", async () => {
    await reviewMutation(id, id, "submit_review", payload); await reviewMutation(id, id, "submit_review", payload);
    expect(mocks.command).toHaveBeenCalledTimes(2);
    expect(mocks.command.mock.calls[0]).toEqual(mocks.command.mock.calls[1]);
    expect(mocks.command.mock.calls[0][2]).toBe(requestId); expect(mocks.command.mock.calls[0][1]).not.toHaveProperty("payment_state");
  });
  it("denies an unavailable assignment before issuing a domain command", async () => {
    mocks.load.mockResolvedValue(null); await expect(reviewMutation(id, id, "submit_review", payload)).rejects.toThrow("permission"); expect(mocks.command).not.toHaveBeenCalled();
  });
  it("checks playable evidence before starting a review", async () => {
    mocks.load.mockResolvedValue({ order: { id, state: "processing", active_attempt_id: null }, attempts: [], reviews: [] });
    await expect(reviewMutation(id, id, "start_review", payload)).rejects.toThrow("Playable"); expect(mocks.command).not.toHaveBeenCalled();
  });
  it("allows a completed lost-response to reach authoritative RPC replay checks", async () => {
    mocks.load.mockResolvedValue({ order: { id, state: "replacement_requested" }, attempts: [], reviews: [{ id }] });
    await reviewMutation(id, id, "submit_review", payload); expect(mocks.command).toHaveBeenCalled();
  });
});
