import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { receiveMockVideo, readMockVideo } from "./mockService";
import { MAX_VIDEO_BYTES } from "./validation";

const mocks = vi.hoisted(() => ({ claims: vi.fn(), from: vi.fn(), begin: vi.fn(), event: vi.fn(), probe: vi.fn(), write: vi.fn(), rename: vi.fn(), read: vi.fn(), rm: vi.fn(), worker: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: mocks.claims }, from: mocks.from }) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.worker }));
vi.mock("../operations", () => ({ runPassportCommand: mocks.begin }));
vi.mock("../providerEvents", () => ({ recordTrustedPassportEvent: mocks.event }));
vi.mock("./probe", () => ({ probeLocalVideo: mocks.probe }));
vi.mock("node:fs/promises", () => ({ mkdir: vi.fn(), writeFile: mocks.write, rename: mocks.rename, readFile: mocks.read, rm: mocks.rm }));
vi.mock("node:fs", () => ({ existsSync: () => true }));
const orderId = "d0000000-0000-4000-8000-000000000001", attemptId = "d0000000-0000-4000-8000-000000000002";
const player = "player";
let order: Record<string, unknown>, attempt: Record<string, unknown>, visible: boolean;
function request(body: BodyInit = "clip", headers: Record<string, string> = {}) {
  return new Request(`http://127.0.0.1:3107/account/development/assessments/${orderId}/video`, { method: "POST", body,
    headers: { origin: "http://127.0.0.1:3107", "content-type": "video/mp4", "x-request-id": "e0000000-0000-4000-8000-000000000003", ...headers } });
}
beforeEach(() => {
  vi.clearAllMocks(); visible = true;
  vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL", ""); vi.stubEnv("PADEL_PASSPORT_PREVIEW", "true");
  vi.stubEnv("PADEL_PASSPORT_MOCK_VIDEO", "true"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:55321");
  vi.stubEnv("PADEL_PASSPORT_MOCK_SERVICE_KEY", "synthetic-test-worker"); vi.stubEnv("PADEL_PASSPORT_MOCK_FFPROBE", "C:/test/ffprobe.exe");
  order = { id: orderId, player_id: player, state: "awaiting_submission", payment_state: "paid", refund_state: "none", active_attempt_id: null,
    terms_snapshot: { max_video_seconds: 90, evidence_requirements: { max_seconds: 90 } } };
  attempt = { id: attemptId, order_id: orderId, provider: null, provider_reference: null, upload_state: "awaiting_upload", validation_state: "pending" };
  mocks.claims.mockResolvedValue({ data: { claims: { sub: player } }, error: null });
  mocks.from.mockImplementation((table) => {
    const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: visible ? table === "pp_orders" ? order : attempt : null, error: null }) };
    return query;
  });
  mocks.begin.mockImplementation(async () => { order.active_attempt_id = attemptId; return { id: attemptId }; });
  mocks.event.mockResolvedValue(undefined); mocks.probe.mockResolvedValue({ duration: 9, mime: "video/mp4" });
  mocks.worker.mockReturnValue({ rpc: vi.fn() }); mocks.read.mockResolvedValue(Buffer.from("clip"));
});
afterEach(() => vi.unstubAllEnvs());

describe("local mock upload boundary", () => {
  it("checks actual bytes before allocating; emits only media events with a server-owned digest", async () => {
    await receiveMockVideo(request(), orderId);
    expect(mocks.probe.mock.invocationCallOrder[0]).toBeLessThan(mocks.begin.mock.invocationCallOrder[0]);
    expect(mocks.begin).toHaveBeenCalledWith("begin_attempt", { order_id: orderId }, expect.any(String));
    expect(mocks.event.mock.calls.map((call) => [call[1], call[3].stage])).toEqual([["media", "uploaded"], ["media", "processing"], ["media", "ready"]]);
    expect(mocks.event.mock.calls[2][3]).toMatchObject({ duration_seconds: 9, bytes: 4, provider: "mock", provider_reference: expect.stringContaining(`mock:${attemptId}:`) });
    expect(mocks.rename).toHaveBeenCalledBefore(mocks.event);
  });
  it.each(["pending", "refunded"])("cannot upload or forge %s funding", async (payment_state) => {
    order.payment_state = payment_state;
    await expect(receiveMockVideo(request(), orderId)).rejects.toMatchObject({ status: 409 });
    expect(mocks.begin).not.toHaveBeenCalled(); expect(mocks.probe).not.toHaveBeenCalled();
  });
  it.each(["cancelled", "completed", "in_review"])("does not reopen %s orders", async (state) => {
    order.state = state; await expect(receiveMockVideo(request(), orderId)).rejects.toMatchObject({ status: 409 });
  });
  it("blocks refunds, foreign accounts, anonymous users and cross-origin requests", async () => {
    order.refund_state = "requested"; await expect(receiveMockVideo(request(), orderId)).rejects.toMatchObject({ status: 409 });
    order.refund_state = "none"; order.player_id = "other"; await expect(receiveMockVideo(request(), orderId)).rejects.toMatchObject({ status: 404 });
    order.player_id = player; mocks.claims.mockResolvedValueOnce({ data: null, error: null });
    await expect(receiveMockVideo(request(), orderId)).rejects.toMatchObject({ status: 401 });
    await expect(receiveMockVideo(request("clip", { origin: "https://other.invalid" }), orderId)).rejects.toMatchObject({ status: 403 });
    expect(mocks.event).not.toHaveBeenCalled();
  });
  it("rejects spoofed/oversize/invalid clips before allocating an attempt", async () => {
    await expect(receiveMockVideo(request("clip", { "content-type": "text/html" }), orderId)).rejects.toThrow("MP4");
    await expect(receiveMockVideo(request("clip", { "content-length": String(MAX_VIDEO_BYTES + 1) }), orderId)).rejects.toMatchObject({ status: 413 });
    mocks.probe.mockResolvedValueOnce({ duration: 91, mime: "video/mp4" });
    await expect(receiveMockVideo(request(), orderId)).rejects.toThrow("90 seconds");
    mocks.probe.mockRejectedValueOnce(new Error("Undecodable")); await expect(receiveMockVideo(request(), orderId)).rejects.toThrow("Export an H.264 MP4");
    expect(mocks.begin).not.toHaveBeenCalled(); expect(mocks.event).not.toHaveBeenCalled();
  });
  it("an interrupted body allocates no attempt and creates no charge", async () => {
    const body = new ReadableStream({ start(controller) { controller.error(new Error("Disconnected")); } });
    const req = new Request(request().url, { method: "POST", body, duplex: "half", headers: Object.fromEntries(request().headers) } as RequestInit);
    await expect(receiveMockVideo(req, orderId)).rejects.toThrow("Disconnected");
    expect(mocks.begin).not.toHaveBeenCalled(); expect(mocks.event).not.toHaveBeenCalled();
  });
  it("enforces the byte cap for chunked bodies without Content-Length", async () => {
    const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(MAX_VIDEO_BYTES + 1)); controller.close(); } });
    const req = new Request(request().url, { method: "POST", body, duplex: "half", headers: Object.fromEntries(request().headers) } as RequestInit);
    await expect(receiveMockVideo(req, orderId)).rejects.toMatchObject({ status: 413 });
    expect(mocks.write).not.toHaveBeenCalled(); expect(mocks.begin).not.toHaveBeenCalled();
  });
  it("rejects simultaneous transfers for the same order before duplicate processing", async () => {
    let release!: (value: { duration: number; mime: string }) => void;
    mocks.probe.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const first = receiveMockVideo(request(), orderId);
    await vi.waitFor(() => expect(mocks.probe).toHaveBeenCalled());
    await expect(receiveMockVideo(request(), orderId)).rejects.toMatchObject({ status: 409 });
    release({ duration: 9, mime: "video/mp4" }); await first;
    expect(mocks.begin).toHaveBeenCalledTimes(1);
  });
  it("can resume processing on the existing attempt without a new allocation", async () => {
    order.state = "processing"; order.active_attempt_id = attemptId;
    await receiveMockVideo(request(), orderId); expect(mocks.begin).not.toHaveBeenCalled();
  });
  it("allocates a free replacement using the same order", async () => {
    order.state = "replacement_requested";
    await receiveMockVideo(request(), orderId);
    expect(mocks.begin).toHaveBeenCalledExactlyOnceWith("begin_attempt", { order_id: orderId }, expect.any(String));
    expect(mocks.event.mock.calls.every((call) => call[1] === "media")).toBe(true);
  });
  it("does not accept a changed clip or stale request ID bound to an old attempt", async () => {
    order.state = "processing"; order.active_attempt_id = attemptId; attempt.provider_reference = "mock:different";
    await expect(receiveMockVideo(request(), orderId)).rejects.toMatchObject({ status: 409 });
    expect(mocks.rename).not.toHaveBeenCalled();
    order.state = "awaiting_submission"; mocks.begin.mockResolvedValueOnce({ id: "d0000000-0000-4000-8000-000000000009" });
    await expect(receiveMockVideo(request(), orderId)).rejects.toThrow("attempt has changed");
  });
  it("success-response retry uses the same ready event without resetting the deadline", async () => {
    order.state = "ready_for_review"; order.active_attempt_id = attemptId;
    attempt.upload_state = "ready"; attempt.provider_reference = `mock:${attemptId}:${createHash("sha256").update("clip").digest("hex")}`;
    await receiveMockVideo(request(), orderId);
    expect(mocks.begin).not.toHaveBeenCalled(); expect(mocks.event).toHaveBeenCalledTimes(1);
    expect(mocks.event.mock.calls[0][3].stage).toBe("ready");
  });
  it("refuses non-local configuration before any privileged client or data read", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://hosted.supabase.co");
    await expect(receiveMockVideo(request(), orderId)).rejects.toThrow("unavailable");
    expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.worker).not.toHaveBeenCalled();
  });
  it("private playback rechecks RLS and never serves unready footage", async () => {
    await expect(readMockVideo(orderId)).rejects.toMatchObject({ status: 409 });
    order.state = "ready_for_review"; order.active_attempt_id = attemptId; attempt.upload_state = "ready"; attempt.provider = "mock"; attempt.mime_type = "video/mp4";
    attempt.provider_reference = `mock:${attemptId}:${createHash("sha256").update("clip").digest("hex")}`;
    expect((await readMockVideo(orderId)).bytes.toString()).toBe("clip");
    expect(mocks.read.mock.calls[0][0]).toContain(`${attemptId}-${createHash("sha256").update("clip").digest("hex")}.video`);
    visible = false; await expect(readMockVideo(orderId)).rejects.toMatchObject({ status: 404 });
  });
});
