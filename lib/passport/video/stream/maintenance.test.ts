import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { maintainStreamVideos, queuePlayerStreamErasure } from "./maintenance";
import { POST } from "@/app/admin/passport/media/route";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), call: vi.fn(), reconcile: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/auth/adminSession", () => ({ getAdminAccount: mocks.admin }));
vi.mock("./config", async (original) => ({ ...await original<typeof import("./config")>(), requireStreamConfig: () => ({ accountId: "a".repeat(32) }) }));
vi.mock("./service", async (original) => ({ ...await original<typeof import("./service")>(), streamStore: () => ({ call: mocks.call }), streamLifecycle: () => ({ reconcile: mocks.reconcile, deleteOwned: mocks.remove }) }));
const id = "f0000000-0000-4000-8000-000000000001";
beforeEach(() => { vi.clearAllMocks(); mocks.admin.mockResolvedValue({ role: "owner", status: "active" }); mocks.call.mockResolvedValue([]); mocks.remove.mockResolvedValue(undefined); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe("operator cleanup controls", () => {
  it.each([null, { role: "support", status: "active" }, { role: "reviewer", status: "active" }, { role: "owner", status: "suspended" }])("denies unprivileged maintenance at both route and service boundaries", async (admin) => {
    mocks.admin.mockResolvedValue(admin); vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(maintainStreamVideos()).rejects.toMatchObject({ status: 403 });
    const response = await POST(new Request("http://127.0.0.1/admin/passport/media", { method: "POST", body: "{}", headers: { origin: "http://127.0.0.1" } }));
    expect(response.status).toBe(403); expect(mocks.call).not.toHaveBeenCalled();
    await expect(queuePlayerStreamErasure(id, "Explicit synthetic erasure approval")).rejects.toMatchObject({ status: 403 });
  });
  it("does not schedule retention without approval and retries only explicitly queued deletion", async () => {
    mocks.call.mockResolvedValue([{ id, phase: "ready", category: "completed", retention_anchor: new Date(0).toISOString() }, { id: "queued", phase: "delete_pending", category: "unfinished" }]);
    const result = await maintainStreamVideos(); expect(result.processed).toBe(2);
    expect(mocks.call).toHaveBeenCalledTimes(1); expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: "queued" }));
  });
  it("protects pending reviews and re-evaluates changed processing category on a fresh pass", async () => {
    vi.stubEnv("PADEL_PASSPORT_STREAM_RETENTION_APPROVED", "true"); vi.stubEnv("PADEL_PASSPORT_STREAM_RETENTION_VERSION", "test");
    vi.stubEnv("PADEL_PASSPORT_STREAM_RETENTION_DAYS", '{"unfinished":1,"failed":7,"replaced":14,"completed":90}');
    mocks.call.mockResolvedValue([{ id, phase: "ready", category: "awaiting_review", retention_anchor: new Date(0).toISOString() }, { id: "processing", phase: "processing", category: "unfinished", retention_anchor: new Date(0).toISOString() }]);
    mocks.reconcile.mockResolvedValue({ phase: "ready" });
    await maintainStreamVideos(); expect(mocks.call).toHaveBeenCalledTimes(1); expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("keeps deletion errors retryable instead of claiming success", async () => {
    mocks.call.mockResolvedValue([{ id, phase: "delete_pending", category: "unfinished" }]); mocks.remove.mockRejectedValue(new Error("provider unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await maintainStreamVideos()).errors).toBe(1);
  });
});
