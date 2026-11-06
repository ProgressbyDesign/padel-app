import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { CloudflareStream, type StreamVideo } from "./cloudflare";
import { openCapability, sealCapability, verifyStreamSignature } from "./crypto";
import { streamConfig, StreamError, type StreamConfig } from "./config";
import { StreamLifecycle, type StreamSession, type StreamStore } from "./service";
import { retentionPolicy } from "./maintenance";

export const fixtureConfig: StreamConfig = { accountId: "a".repeat(32), apiToken: "synthetic-api-token", webhookSecret: "synthetic-webhook-secret", customerCode: "test123", capabilityKey: Buffer.alloc(32, 7).toString("base64"), serviceKey: "synthetic-local-worker", maxBytes: 50 * 1024 * 1024 };
const uid = "b".repeat(32), id = "f0000000-0000-4000-8000-000000000001";
const baseSession: StreamSession = { id, order_id: id, attempt_id: id, player_id: id, phase: "bound", provider_uid: uid, account_id: fixtureConfig.accountId, upload_ciphertext: null, expires_at: new Date(Date.now() + 900000).toISOString(), declared_bytes: 12000, max_bytes: 52428800, max_seconds: 90, mime_type: "video/quicktime", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deletion_reason: null, delete_after: null };
// Shape follows official Stream webhook/video-detail examples. These are not
// captured live responses or evidence of actual account activation.
const ready: StreamVideo = { uid, creator: id, requireSignedURLs: true, readyToStream: true, status: { state: "ready" }, size: 12000, duration: 80, input: { width: 640, height: 480 } };
const envelope = (result: unknown) => Response.json({ success: true, result });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("Cloudflare official wire contracts", () => {
  it("creates a private bounded tus session with UID from its header, not the URL", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 201, headers: { location: "https://upload.videodelivery.net/tus/opaque-capability", "stream-media-id": uid } }));
    expect(await new CloudflareStream(fixtureConfig, fetcher).createSession(baseSession)).toEqual({ uid, uploadUrl: "https://upload.videodelivery.net/tus/opaque-capability" });
    const [url, request] = fetcher.mock.calls[0]; expect(url).toContain("?direct_user=true");
    expect(request.headers).toMatchObject({ "Tus-Resumable": "1.0.0", "Upload-Length": "12000", "Upload-Creator": id });
    expect(request.headers["Upload-Metadata"]).toContain("requiresignedurls");
    expect(request.headers["Upload-Metadata"]).toContain(`maxDurationSeconds ${Buffer.from("90").toString("base64")}`);
    expect(request.headers["Upload-Metadata"]).toContain("expiry ");
  });
  it.each(["http://upload.videodelivery.net/tus/a", "https://attacker.invalid/tus/a", "https://upload.videodelivery.net.attacker.invalid/tus/a"])("rejects unsafe capability %s", async (location) => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 201, headers: { location, "stream-media-id": uid } }));
    await expect(new CloudflareStream(fixtureConfig, fetcher).createSession(baseSession)).rejects.toThrow("invalid session");
  });
  it("does not retry ambiguous creation or leak provider diagnostics", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("private provider body", { status: 500 }));
    await expect(new CloudflareStream(fixtureConfig, fetcher).createSession(baseSession)).rejects.toMatchObject({ code: "PROVIDER_HTTP_500", retryable: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("issues only short private playback without downloadable originals", async () => {
    const now = Date.now(), exp = Math.floor(now / 1000) + 120;
    const token = `header.${Buffer.from(JSON.stringify({ sub: uid, exp })).toString("base64url")}.fixture`;
    const fetcher = vi.fn().mockResolvedValue(envelope({ token }));
    const playback = await new CloudflareStream(fixtureConfig, fetcher).playback(uid, now);
    expect(playback.url).toContain(`/${token}/iframe`);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ exp, downloadable: false, flags: { original: false } });
    for (const invalidExpiry of [undefined, null, "not-a-timestamp", String(exp), exp + 100, Math.floor(now / 1000)]) {
      const wrong = `header.${Buffer.from(JSON.stringify({ sub: uid, exp: invalidExpiry })).toString("base64url")}.fixture`;
      fetcher.mockResolvedValue(envelope({ token: wrong }));
      await expect(new CloudflareStream(fixtureConfig, fetcher).playback(uid, now)).rejects.toMatchObject({ code: "INVALID_PLAYBACK_TOKEN" });
    }
  });
  it("rejects unknown UID metadata and treats delete 404 as idempotent", async () => {
    const fetcher = vi.fn().mockResolvedValue(envelope({ ...ready, uid: "c".repeat(32) }));
    await expect(new CloudflareStream(fixtureConfig, fetcher).video(uid)).rejects.toMatchObject({ code: "VIDEO_MISMATCH" });
    fetcher.mockResolvedValue(new Response(null, { status: 404 }));
    await expect(new CloudflareStream(fixtureConfig, fetcher).deleteVideo(uid)).resolves.toBeUndefined();
  });
});
describe("capability and webhook cryptography", () => {
  it("binds encrypted upload capabilities to their specific session", () => {
    const value = sealCapability("https://upload.videodelivery.net/private", fixtureConfig.capabilityKey, id);
    expect(value).not.toContain("private"); expect(openCapability(value, fixtureConfig.capabilityKey, id)).toContain("/private");
    expect(() => openCapability(value, fixtureConfig.capabilityKey, "other")).toThrow("cannot be resumed");
  });
  it("accepts official raw-byte signatures and rejects changes, old/future times and malformed headers", () => {
    const body = Buffer.from('{"uid":"fixture"}\n'), now = Date.now(), time = Math.floor(now / 1000);
    const signature = createHmac("sha256", fixtureConfig.webhookSecret).update(`${time}.`).update(body).digest("hex");
    const header = `time=${time},sig1=${signature}`;
    expect(() => verifyStreamSignature(body, header, fixtureConfig.webhookSecret, now)).not.toThrow();
    expect(() => verifyStreamSignature(Buffer.from(body.toString().trim()), header, fixtureConfig.webhookSecret, now)).toThrow();
    for (const invalid of [null, `time=${time},sig1=bad`, `time=${time},time=${time},sig1=${signature}`]) expect(() => verifyStreamSignature(body, invalid, fixtureConfig.webhookSecret, now)).toThrow();
    for (const offset of [-301000, 301000]) expect(() => verifyStreamSignature(body, header, fixtureConfig.webhookSecret, now + offset)).toThrow();
  });
});

function lifecycleFixture(overrides: Partial<StreamSession> = {}, metadata: StreamVideo = ready) {
  let session = { ...baseSession, ...overrides };
  const calls: { action: string; data: Record<string, unknown> }[] = [];
  const store: StreamStore = { async call<T>(action: string, data: Record<string, unknown>) {
    calls.push({ action, data });
    if (action === "claim") { session.phase = "creating"; return { claimed: true } as T; }
    if (action === "bind") { session = { ...session, phase: "bound", provider_uid: data.uid as string, upload_ciphertext: data.ciphertext as string ?? null }; }
    if (action === "uncertain") session.phase = "uncertain";
    if (action === "reconcile" && data.stage !== "pending") session.phase = data.stage as string;
    if (action === "expire") session.phase = "failed";
    if (action === "deleted") session.phase = "deleted";
    return { ...session } as T;
  } };
  const provider = { video: vi.fn().mockResolvedValue(metadata), createSession: vi.fn().mockResolvedValue({ uid, uploadUrl: "https://upload.videodelivery.net/tus/fixture" }), videosForCreator: vi.fn().mockResolvedValue([]), deleteVideo: vi.fn().mockResolvedValue(undefined) };
  const lifecycle = new StreamLifecycle(fixtureConfig, store, provider as unknown as CloudflareStream);
  return { lifecycle, calls, provider, session: () => ({ ...session }) };
}
describe("processing and lifecycle orchestration", () => {
  it("claims once, durably binds encrypted capability and reuses matching sessions", async () => {
    const f = lifecycleFixture({ phase: "reserved", provider_uid: null });
    expect((await f.lifecycle.provision(id)).uploadUrl).toContain("upload.videodelivery.net");
    await f.lifecycle.provision(id); expect(f.provider.createSession).toHaveBeenCalledTimes(1);
    expect(f.calls.find((call) => call.action === "bind")?.data.ciphertext).not.toContain("videodelivery");
  });
  it("records uncertain creation and never blindly repeats the external POST", async () => {
    const f = lifecycleFixture({ phase: "reserved", provider_uid: null }); f.provider.createSession.mockRejectedValue(new StreamError("TIMEOUT", "Timed out."));
    await expect(f.lifecycle.provision(id)).rejects.toThrow("Timed out");
    await expect(f.lifecycle.provision(id)).rejects.toMatchObject({ code: "SESSION_PENDING" });
    expect(f.provider.createSession).toHaveBeenCalledTimes(1); expect(f.session().phase).toBe("uncertain");
  });
  it("uses provider GET rather than webhook-supplied processing state; replay cannot reset the clock", async () => {
    const f = lifecycleFixture(); const body = Buffer.from(JSON.stringify({ uid, readyToStream: false, status: { state: "error" } }));
    const time = Math.floor(Date.now() / 1000), sig = createHmac("sha256", fixtureConfig.webhookSecret).update(`${time}.`).update(body).digest("hex");
    await f.lifecycle.webhook(body, `time=${time},sig1=${sig}`); await f.lifecycle.webhook(body, `time=${time},sig1=${sig}`);
    expect(f.calls.filter((call) => call.action === "reconcile")).toHaveLength(1);
    expect(f.calls.find((call) => call.action === "reconcile")?.data).toMatchObject({ stage: "ready", duration: 80, bytes: 12000 });
  });
  it.each([{ ...ready, duration: 91 }, { ...ready, size: 12001 }, { ...ready, input: { width: 0, height: 0 } }])("rejects noncompliant processed metadata", async (metadata) => {
    const f = lifecycleFixture({}, metadata); await f.lifecycle.reconcile(f.session());
    expect(f.calls.at(-2)?.data.stage).toBe("failed");
  });
  it.each([{ ...ready, creator: "unowned" }, { ...ready, requireSignedURLs: false }])("rejects unowned or public media", async (metadata) => {
    const f = lifecycleFixture({}, metadata); await expect(f.lifecycle.reconcile(f.session())).rejects.toMatchObject({ code: "OWNERSHIP_MISMATCH" });
    expect(f.calls.some((call) => call.action === "reconcile")).toBe(false);
  });
  it("expires unbound sessions without payment and preserves already-uploaded processing past expiry", async () => {
    const f = lifecycleFixture({ phase: "uncertain", provider_uid: null, expires_at: new Date(0).toISOString() });
    await expect(f.lifecycle.provision(id)).rejects.toMatchObject({ code: "UPLOAD_EXPIRED" });
    expect(f.calls.some((call) => call.action === "expire")).toBe(true);
    const processing = lifecycleFixture({ expires_at: new Date(0).toISOString() }, { ...ready, readyToStream: false, status: { state: "queued" } });
    expect((await processing.lifecycle.provision(id)).phase).toBe("processing");
  });
  it("deletes only explicitly queued owned media, audits retryable errors", async () => {
    const f = lifecycleFixture({ phase: "delete_pending" }); await f.lifecycle.deleteOwned(f.session());
    expect(f.provider.deleteVideo).toHaveBeenCalledWith(uid); expect(f.session().phase).toBe("deleted");
    const bad = lifecycleFixture({ phase: "delete_pending" }, { ...ready, creator: "other" });
    await expect(bad.lifecycle.deleteOwned(bad.session())).rejects.toMatchObject({ code: "DELETE_OWNERSHIP" }); expect(bad.provider.deleteVideo).not.toHaveBeenCalled();
    const error = lifecycleFixture({ phase: "delete_pending" }); error.provider.deleteVideo.mockRejectedValue(new Error("Network"));
    await expect(error.lifecycle.deleteOwned(error.session())).rejects.toThrow(); expect(error.calls.some((call) => call.action === "delete_failed")).toBe(true);
    await expect(lifecycleFixture().lifecycle.deleteOwned(baseSession)).rejects.toMatchObject({ code: "DELETE_DENIED" });
  });
});
describe("release and retention defaults", () => {
  it("fails closed without credentials and in production", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("PADEL_PASSPORT_STREAM_ENABLED", "true"); expect(streamConfig()).toBeNull();
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("PADEL_PASSPORT_PREVIEW", "true"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:55321"); expect(streamConfig()).toBeNull();
  });
  it("sets no retention clock without explicit approved policy/version", () => {
    expect(retentionPolicy()).toBeNull(); vi.stubEnv("PADEL_PASSPORT_STREAM_RETENTION_APPROVED", "true"); expect(() => retentionPolicy()).toThrow();
    vi.stubEnv("PADEL_PASSPORT_STREAM_RETENTION_VERSION", "test-policy"); vi.stubEnv("PADEL_PASSPORT_STREAM_RETENTION_DAYS", '{"unfinished":null,"failed":null,"replaced":null,"completed":null}');
    expect(retentionPolicy()?.days.completed).toBeNull();
  });
});
