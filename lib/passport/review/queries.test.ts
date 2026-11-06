import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadReviewDetail, loadReviewSummaries } from "./queries";
const mocks = vi.hoisted(() => ({ claims: vi.fn(), filters: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: mocks.claims }, from: mocks.from, rpc: mocks.rpc }) }));
const id = "f1000000-0000-4000-8000-000000000001", coach = "f1000000-0000-4000-8000-000000000009";
let visible = true, fail = false;
beforeEach(() => {
  vi.clearAllMocks(); visible = true; fail = false;
  vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL", ""); vi.stubEnv("PADEL_PASSPORT_PREVIEW", "true"); vi.stubEnv("PADEL_PASSPORT_MOCK_VIDEO", "true"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:55321");
  mocks.claims.mockResolvedValue({ data: { claims: { sub: "current-user" } }, error: null });
  mocks.rpc.mockResolvedValue({ data: [{ order_id: id, player_name: "Private player" }], error: null });
  mocks.from.mockImplementation(table => {
    const rows = table === "pp_orders" && visible ? [{ id, parent_order_id: null, active_attempt_id: null }] : [];
    const result = () => ({ data: rows, error: fail ? { message: "Private server diagnostic" } : null });
    const q = { select: () => q, eq: (key: string, value: string) => { mocks.filters(table, key, value); return q; }, in: () => q, order: () => q, limit: () => q, maybeSingle: async () => ({ ...result(), data: rows[0] ?? null }), then: (resolve: (r: unknown) => void) => Promise.resolve(result()).then(resolve) };
    return q;
  });
});
afterEach(() => vi.unstubAllEnvs());
describe("current caller's assessment queries", () => {
  it("constrains coach queue by named individual and purchased coach in addition to RLS", async () => {
    await loadReviewSummaries(coach);
    expect(mocks.filters).toHaveBeenCalledWith("pp_orders", "assessor_user_id", "current-user");
    expect(mocks.filters).toHaveBeenCalledWith("pp_orders", "purchased_coach_id", coach);
  });
  it("scopes player detail to the current player, never a supplied player ID", async () => {
    await loadReviewDetail(id);
    expect(mocks.filters).toHaveBeenCalledWith("pp_orders", "player_id", "current-user");
    expect(mocks.rpc).toHaveBeenCalledWith("passport_review_context", { p_orders: [id] });
  });
  it("does not read feedback or resolve identity after an invisible order", async () => {
    visible = false; expect(await loadReviewDetail(id, coach)).toBeNull();
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalledWith("pp_reviews");
  });
  it("requires real claims before looking up orders", async () => {
    mocks.claims.mockResolvedValue({ data: null, error: null });
    await expect(loadReviewSummaries(coach)).rejects.toThrow("Sign in"); expect(mocks.from).not.toHaveBeenCalled();
  });
  it("returns no preview in production or against a hosted URL", async () => {
    vi.stubEnv("NODE_ENV", "production"); expect(await loadReviewSummaries(coach)).toEqual([]);
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://production.supabase.co");
    expect(await loadReviewDetail(id, coach)).toBeNull(); expect(mocks.from).not.toHaveBeenCalled();
  });
  it("does not serialize private database diagnostics", async () => { fail = true; await expect(loadReviewDetail(id, coach)).rejects.toThrow("Assessment records could not be loaded."); });
});
