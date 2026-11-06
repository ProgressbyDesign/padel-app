import { afterEach, describe, expect, it, vi } from "vitest";
import type { UploadOptions } from "tus-js-client";
import { createStreamBrowserProvider } from "./browser";
import { validateVideo } from "../validation";

const saved = new Map<string, string>();
const storage = { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value), removeItem: (key: string) => saved.delete(key) };
afterEach(() => { vi.unstubAllGlobals(); saved.clear(); });
const session = () => Response.json({ phase: "uploading", uploadUrl: "https://upload.videodelivery.net/tus/private", expiresAt: new Date(Date.now()+900000).toISOString() });

describe("mobile tus adapter", () => {
  it.each(["video/mp4", "video/quicktime"])("accepts %s and transfers directly without storing credentials/capabilities", async (type) => {
    vi.stubGlobal("localStorage", storage);
    const options: UploadOptions[] = [], fetcher = vi.fn().mockImplementation(async (url: string) => url.endsWith("/status") ? Response.json({ phase: "ready" }) : session());
    vi.stubGlobal("fetch", fetcher);
    class Upload { constructor(_file: File, private opts: UploadOptions) { options.push(opts); } start() { this.opts.onProgress?.(10,10); this.opts.onSuccess?.({ lastResponse: { getStatus: () => 204, getHeader: () => undefined, getBody: () => "", getUnderlyingObject: () => null } }); } async abort() {} }
    const file = new File(["synthetic"], type === "video/mp4" ? "android.mp4" : "iphone.mov", { type });
    expect(validateVideo({ bytes: file.size, mime: file.type, duration: 80 })).toBeNull();
    const progress = vi.fn(), processing = vi.fn();
    await createStreamBrowserProvider(async () => ({ Upload })).upload({ orderId: crypto.randomUUID(), requestId: crypto.randomUUID(), file, signal: new AbortController().signal, onProgress: progress, onProcessing: processing });
    expect(options[0]).toMatchObject({ chunkSize: 5242880, storeFingerprintForResuming: false });
    expect(options[0].endpoint).toBeUndefined(); expect(options[0].headers).toBeUndefined();
    expect(progress).toHaveBeenCalledWith(100); expect(processing).toHaveBeenCalled();
    expect(fetcher.mock.calls.every((call) => String(call[0]).startsWith("/account/development/assessments/"))).toBe(true);
    expect(saved.size).toBe(0);
  });
  it("retains an opaque request key across interruption and retry, never the upload URL", async () => {
    vi.stubGlobal("localStorage", storage);
    const requests: string[] = [];
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (_url: string, init: RequestInit) => { requests.push(JSON.parse(init.body as string).requestId); return session(); }));
    class Upload { constructor(_file: File, private opts: UploadOptions) {} start() { this.opts.onError?.(new Error("network") as never); } async abort() {} }
    const provider = createStreamBrowserProvider(async () => ({ Upload }));
    const input = { orderId: crypto.randomUUID(), requestId: crypto.randomUUID(), file: new File(["fixture"], "private-name.mov", { type: "video/quicktime", lastModified: 100 }), signal: new AbortController().signal, onProgress: vi.fn(), onProcessing: vi.fn() };
    await expect(provider.upload(input)).rejects.toThrow("interrupted"); await expect(provider.upload(input)).rejects.toThrow("interrupted");
    expect(requests[0]).toBe(requests[1]);
    const value = [...saved.values()].join(""); expect(value).not.toContain("videodelivery"); expect(value).not.toContain("private-name");
  });
  it("an expired permission rotates the request key for a free retry", async () => {
    vi.stubGlobal("localStorage", storage); const requests: string[] = [];
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (_url: string, init: RequestInit) => { requests.push(JSON.parse(init.body as string).requestId); return Response.json({ code: "UPLOAD_EXPIRED", error: "Expired" }, { status: 410 }); }));
    const input = { orderId: crypto.randomUUID(), requestId: crypto.randomUUID(), file: new File(["fixture"], "clip.mp4", { type: "video/mp4" }), signal: new AbortController().signal, onProgress: vi.fn(), onProcessing: vi.fn() };
    const provider = createStreamBrowserProvider();
    await expect(provider.upload(input)).rejects.toThrow("Expired"); await expect(provider.upload(input)).rejects.toThrow("Expired");
    expect(requests[0]).not.toBe(requests[1]);
  });
  it("pauses without invoking remote termination or charging again", async () => {
    vi.stubGlobal("localStorage", storage); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(session()));
    const abort = vi.fn().mockResolvedValue(undefined), started = vi.fn();
    class Upload { start() { started(); } abort = abort; }
    const controller = new AbortController();
    const pending = createStreamBrowserProvider(async () => ({ Upload })).upload({ orderId: crypto.randomUUID(), requestId: crypto.randomUUID(), file: new File(["clip"], "clip.mp4", { type: "video/mp4" }), signal: controller.signal, onProgress: vi.fn(), onProcessing: vi.fn() });
    await vi.waitFor(() => expect(started).toHaveBeenCalled()); controller.abort();
    await expect(pending).rejects.toThrow("paused"); expect(abort).toHaveBeenCalledWith(false);
  });
});
