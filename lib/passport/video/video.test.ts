import { afterEach, describe, expect, it, vi } from "vitest";
import { canSubmit, type SubmissionOrder } from "./contracts";
import { localVideoEnabled } from "./localConfig";
import { MAX_VIDEO_BYTES, validateVideo, videoLimit } from "./validation";

afterEach(() => vi.unstubAllEnvs());
const video = { bytes: 1000, mime: "video/mp4", duration: 90 };
describe("video validation and purchase boundary", () => {
  it.each(["video/mp4", "video/webm", "video/quicktime"])("accepts %s at the exact duration/size limit", (mime) => {
    expect(validateVideo({ ...video, mime, bytes: MAX_VIDEO_BYTES })).toBeNull();
  });
  it.each(["image/png", "text/html", "video/avi", ""])("rejects incompatible type %s", (mime) => {
    expect(validateVideo({ ...video, mime })).toContain("MP4");
  });
  it("rejects oversize, empty, unreadable and excessive duration", () => {
    expect(validateVideo({ ...video, bytes: MAX_VIDEO_BYTES + 1 })).toContain("50 MB");
    expect(validateVideo({ ...video, bytes: 0 })).toContain("empty");
    for (const duration of [NaN, Infinity, 0, -1]) expect(validateVideo({ ...video, duration })).not.toBeNull();
    expect(validateVideo({ ...video, duration: 90.001 })).toContain("90 seconds");
    expect(validateVideo(video, videoLimit(120, 60))).toContain("60 seconds");
    expect(videoLimit(120, 120)).toBe(90);
  });
  it("permits only funded non-refunded evidence states, including resumable technical retry", () => {
    const order = { payment_state: "paid", refund_state: "none", state: "awaiting_submission" } as SubmissionOrder;
    expect(canSubmit(order, null)).toBe(true);
    expect(canSubmit({ ...order, state: "replacement_requested" }, null)).toBe(true);
    expect(canSubmit({ ...order, payment_state: "pending" }, null)).toBe(false);
    expect(canSubmit({ ...order, refund_state: "requested" }, null)).toBe(false);
    for (const state of ["ready_for_review", "in_review", "completed", "cancelled"] as const) expect(canSubmit({ ...order, state }, null)).toBe(false);
    expect(canSubmit({ ...order, state: "processing" }, { id: "a", attempt_number: 1, upload_state: "uploaded", validation_state: "pending", failure_reason: null, recording_guidance: null })).toBe(true);
  });
  it("never enables a hosted or production mock, even with opt-in flags", () => {
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL", "");
    vi.stubEnv("PADEL_PASSPORT_PREVIEW", "true"); vi.stubEnv("PADEL_PASSPORT_MOCK_VIDEO", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://existing.supabase.co");
    expect(localVideoEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:55321");
    expect(localVideoEnabled()).toBe(true);
    vi.stubEnv("VERCEL", "1"); expect(localVideoEnabled()).toBe(false);
    vi.stubEnv("VERCEL", ""); vi.stubEnv("NODE_ENV", "production"); expect(localVideoEnabled()).toBe(false);
  });
});
