import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runPassportCommand } from "./operations";
import { recordTrustedPassportEvent } from "./providerEvents";

const mocks = vi.hoisted(() => ({ create: vi.fn(), claims: vi.fn(), rpc: vi.fn(), admin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.create }));
vi.mock("@/lib/auth/adminSession", () => ({ getAdminAccount: mocks.admin }));
const requestId = "d0000000-0000-4000-8000-000000000020";
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL", ""); vi.stubEnv("PADEL_PASSPORT_PREVIEW", "true");
  mocks.create.mockReset().mockResolvedValue({ auth: { getClaims: mocks.claims }, rpc: mocks.rpc });
  mocks.claims.mockReset().mockResolvedValue({ data: { claims: { sub: "player-id" } }, error: null });
  mocks.rpc.mockReset().mockResolvedValue({ data: { id: "order-id" }, error: null });
  mocks.admin.mockReset().mockResolvedValue(null);
});
afterEach(() => vi.unstubAllEnvs());

describe("Passport server boundary", () => {
  it("preserves the production restriction even when the flag is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(runPassportCommand("begin_attempt", { order_id: "order-id" }, requestId)).rejects.toThrow("not enabled");
    await expect(recordTrustedPassportEvent({ rpc: mocks.rpc }, "payment", "mock:event", { order_id: "order-id", amount_minor: 3500, currency: "GBP", payment_reference: "mock:payment" })).rejects.toThrow("not enabled");
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("requires existing authentication and rejects malformed request IDs", async () => {
    await expect(runPassportCommand("begin_attempt", { order_id: "order-id" }, "bad-id")).rejects.toThrow("UUID");
    mocks.claims.mockResolvedValue({ data: null, error: { message: "expired" } });
    await expect(runPassportCommand("begin_attempt", { order_id: "order-id" }, requestId)).rejects.toThrow("Sign in");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("passes only order selection and the stable request ID to the transactional RPC", async () => {
    const payload = { offer_id: "offer-id", policy_id: "policy-id" };
    expect(await runPassportCommand("create_order", payload, requestId)).toEqual({ id: "order-id" });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("passport_command", { p_command: "create_order", p_payload: payload, p_request_id: requestId });
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it.each(["reviewer", "support", "operations"])("does not let %s approve commercial terms", async (role) => {
    mocks.admin.mockResolvedValue({ role, status: "active" });
    await expect(runPassportCommand("publish_policy", { id: "policy-id", reason: "Approved for testing" }, requestId)).rejects.toThrow("administrator");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("allows an active operations admin to manage assessor eligibility", async () => {
    mocks.admin.mockResolvedValue({ role: "operations", status: "active" });
    await runPassportCommand("set_assessor", { id: "grant-id", status: "suspended", reason: "Credentials need a further check" }, requestId);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("does not expose database details in mutation errors", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Private metadata and SQL details" } });
    await expect(runPassportCommand("begin_attempt", { order_id: "order-id" }, requestId)).rejects.toThrow("The Passport operation could not be completed.");
  });
  it("normalizes trusted mock events without loading a service client or SDK", async () => {
    const payload = { order_id: "order-id", attempt_id: "attempt-id", stage: "failed" as const, reason: "Processing failed; retry is available" };
    await recordTrustedPassportEvent({ rpc: mocks.rpc }, "media", "mock:failed-1", payload);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("passport_provider_event", { p_source: "media", p_event_id: "mock:failed-1", p_payload: payload });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects events without stable IDs and propagates a generic worker failure", async () => {
    const payload = { order_id: "order-id", amount_minor: 3500, currency: "GBP", payment_reference: "mock:payment" };
    await expect(recordTrustedPassportEvent({ rpc: mocks.rpc }, "payment", "", payload)).rejects.toThrow("stable provider event");
    mocks.rpc.mockResolvedValue({ error: { message: "Internal event error" } });
    await expect(recordTrustedPassportEvent({ rpc: mocks.rpc }, "payment", "mock:event", payload)).rejects.toThrow("could not be recorded");
  });
});
