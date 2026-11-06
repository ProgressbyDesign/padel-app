import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sessionEndpoint, playbackEndpoint, boundedRequest, streamResponse } from "./http";
import { StreamError } from "./config";

const mocks = vi.hoisted(() => ({ claims: vi.fn(), from: vi.fn(), rpc: vi.fn(), provision: vi.fn(), store: vi.fn(), video: vi.fn(), playback: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: mocks.claims }, from: mocks.from, rpc: mocks.rpc }) }));
vi.mock("./config", async (original) => ({ ...await original<typeof import("./config")>(), requireStreamConfig: () => ({ accountId: "a".repeat(32), maxBytes: 52428800 }) }));
vi.mock("./service", async (original) => ({ ...await original<typeof import("./service")>(), streamLifecycle: () => ({ provision: mocks.provision }), streamStore: () => ({ call: mocks.store }) }));
vi.mock("./cloudflare", () => ({ CloudflareStream: class { video = mocks.video; playback = mocks.playback; } }));
const id = "f0000000-0000-4000-8000-000000000011", uid = "b".repeat(32);
let order: Record<string, unknown> | null, attempt: Record<string, unknown> | null;
function request(body: unknown = { requestId: id, bytes: 12000, mime: "video/quicktime", fingerprint: "f".repeat(64) }, origin = "http://127.0.0.1:3107") {
  return new Request(`http://127.0.0.1:3107/account/development/assessments/${id}/upload-session`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.clearAllMocks(); order = { id, player_id: "player", active_attempt_id: id, payment_state: "paid", refund_state: "none", state: "processing" };
  attempt = { id, provider: "cloudflare_stream", provider_reference: uid, upload_state: "ready" };
  mocks.claims.mockResolvedValue({ data: { claims: { sub: "player" } }, error: null });
  mocks.from.mockImplementation((table) => { const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: table === "pp_orders" ? order : attempt, error: null }) }; return query; });
  mocks.rpc.mockResolvedValue({ data: { id }, error: null }); mocks.provision.mockResolvedValue({ phase: "uploading", uploadUrl: "https://upload.videodelivery.net/tus/fixture" });
  mocks.store.mockResolvedValue({ id, attempt_id: id, provider_uid: uid, phase: "ready" });
  mocks.video.mockResolvedValue({ uid, creator: id, requireSignedURLs: true, readyToStream: true, status: { state: "ready" } });
  mocks.playback.mockResolvedValue({ url: "https://customer-test.cloudflarestream.com/fixture-token/iframe", expiresAt: Date.now() + 120000 });
});
afterEach(() => vi.restoreAllMocks());
describe("authenticated Stream HTTP boundaries", () => {
  it("passes only declared video metadata to the actor RPC and returns an owned upload permission", async () => {
    const response = await sessionEndpoint(request(), id);
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.rpc).toHaveBeenCalledWith("passport_stream_reserve", { p_order: id, p_key: id, p_bytes: 12000, p_mime: "video/quicktime", p_fingerprint: "f".repeat(64) });
    expect(await response.json()).not.toHaveProperty("apiToken");
  });
  it("denies anonymous, foreign-player and unpaid/refunded uploads before reserving/provider calls", async () => {
    mocks.claims.mockResolvedValueOnce({ data: null, error: null }); await expect(sessionEndpoint(request(), id)).rejects.toMatchObject({ status: 401 });
    order!.player_id = "other"; await expect(sessionEndpoint(request(), id)).rejects.toMatchObject({ status: 404 });
    order!.player_id = "player"; order!.payment_state = "pending"; await expect(sessionEndpoint(request(), id)).rejects.toMatchObject({ status: 409 });
    order!.payment_state = "paid"; order!.refund_state = "requested"; await expect(sessionEndpoint(request(), id)).rejects.toMatchObject({ status: 409 });
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.provision).not.toHaveBeenCalled();
  });
  it("rejects cross-origin and oversized declarations without provider creation", async () => {
    await expect(sessionEndpoint(request({}, "https://other.invalid"), id)).rejects.toMatchObject({ status: 403 });
    await expect(sessionEndpoint(request({ requestId: id, bytes: 52428801, mime: "video/mp4", fingerprint: "f".repeat(64) }), id)).rejects.toMatchObject({ status: 400 });
    expect(mocks.provision).not.toHaveBeenCalled();
  });
  it("rechecks RLS/assignment for every private playback; no raw UID selection is accepted", async () => {
    const response = await playbackEndpoint(id); expect(response.headers.get("referrer-policy")).toBe("no-referrer"); expect(mocks.playback).toHaveBeenCalledWith(uid);
    order = null; await expect(playbackEndpoint(id)).rejects.toMatchObject({ status: 404 });
    expect(mocks.playback).toHaveBeenCalledTimes(1);
  });
  it("never signs a public, unowned or deletion-pending video", async () => {
    mocks.video.mockResolvedValueOnce({ uid, creator: "other", requireSignedURLs: true }); await expect(playbackEndpoint(id)).rejects.toMatchObject({ status: 409 });
    mocks.store.mockResolvedValueOnce({ id, attempt_id: id, provider_uid: uid, phase: "delete_pending" }); await expect(playbackEndpoint(id)).rejects.toMatchObject({ status: 409 });
    expect(mocks.playback).not.toHaveBeenCalled();
  });
  it("bounds raw webhook input even without a Content-Length header", async () => {
    const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(65537)); controller.close(); } });
    const req = new Request("http://127.0.0.1/webhook", { method: "POST", body, duplex: "half" } as RequestInit);
    await expect(boundedRequest(req)).rejects.toMatchObject({ status: 413 });
  });
  it("returns/logs only structured safe error fields", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await streamResponse("fixture", async () => { throw new Error("private-token-and-personal-data"); });
    expect(JSON.stringify(await response.json())).not.toContain("private-token"); expect(JSON.stringify(spy.mock.calls)).not.toContain("private-token");
    const notFound = await streamResponse("fixture", async () => { throw new StreamError("NOT_FOUND", "Video unavailable.", 404); }); expect(notFound.status).toBe(404);
  });
});
