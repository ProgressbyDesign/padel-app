import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadOwnPassport } from "./queries";

const mocks = vi.hoisted(() => ({ create: vi.fn(), claims: vi.fn(), filters: vi.fn(), tables: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.create }));
let fail = false;
class Query {
  constructor(private table: string) {}
  select() { return this; }
  eq(column: string, value: string) { mocks.filters(this.table, column, value); return this; }
  in(column: string, values: string[]) { mocks.filters(this.table, column, values); return this; }
  order() { return this; }
  then(resolve: (value: { data: unknown[]; error: { message: string } | null }) => unknown) {
    return Promise.resolve(resolve({ data: this.table === "pp_orders" ? [{ id: "own-order" }] : [], error: fail ? { message: "Private failure" } : null }));
  }
}
beforeEach(() => {
  fail = false;
  vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL", ""); vi.stubEnv("PADEL_PASSPORT_PREVIEW", "true");
  mocks.claims.mockReset().mockResolvedValue({ data: { claims: { sub: "current-player" } }, error: null });
  mocks.filters.mockReset(); mocks.tables.mockReset();
  mocks.create.mockReset().mockResolvedValue({ auth: { getClaims: mocks.claims }, from: (table: string) => { mocks.tables(table); return new Query(table); } });
});
afterEach(() => vi.unstubAllEnvs());
describe("private Passport reads", () => {
  it("scopes all player records and feedback to the authenticated account", async () => {
    const result = await loadOwnPassport();
    expect(result.orders).toEqual([{ id: "own-order" }]);
    expect(mocks.filters).toHaveBeenCalledWith("pp_orders", "player_id", "current-player");
    expect(mocks.filters).toHaveBeenCalledWith("pp_skill_verifications", "player_id", "current-player");
    expect(mocks.filters).toHaveBeenCalledWith("pp_passport_skill_records", "player_id", "current-player");
    expect(mocks.filters).toHaveBeenCalledWith("pp_reviews", "order_id", ["own-order"]);
  });
  it("refuses production reads of unfinished data", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(loadOwnPassport()).rejects.toThrow("not enabled");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("requires sign-in before reading assessment tables", async () => {
    mocks.claims.mockResolvedValue({ data: null, error: { message: "expired" } });
    await expect(loadOwnPassport()).rejects.toThrow("Sign in");
    expect(mocks.tables).not.toHaveBeenCalled();
  });
  it("fails closed without leaking a database diagnostic", async () => {
    fail = true;
    await expect(loadOwnPassport()).rejects.toThrow("Your Passport could not be loaded.");
  });
});
