import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasAdminPermission, type AdminRole } from "./permissions";

const state = vi.hoisted(() => ({
  role: "operations" as AdminRole | null,
  claims: { sub: "ops-admin" } as Record<string, unknown> | null,
  rpc: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/adminSession", () => ({
  getAdminAccount: async () =>
    state.role
      ? { id: "ops-admin", role: state.role, status: "active" }
      : null,
}));
vi.mock("@/lib/admin/audit", () => ({
  writeAdminAuditEvent: (...args: unknown[]) => state.audit(...args),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getClaims: async () => ({
        data: { claims: state.claims },
        error: state.claims ? null : new Error("signed out"),
      }),
    },
    rpc: state.rpc,
  }),
}));

import {
  bulkSetCoachVerification,
  bulkUnclaimCoaches,
} from "@/app/admin/(ops)/coachDirectoryActions";

const COACH_A = "11111111-1111-4111-8111-111111111111";
const COACH_B = "22222222-2222-4222-8222-222222222222";

describe("coach directory server actions", () => {
  beforeEach(() => {
    state.role = "operations";
    state.claims = { sub: "ops-admin" };
    state.rpc.mockReset();
    state.audit.mockReset();
    state.audit.mockResolvedValue({ ok: true });
  });

  it("marks one coach approved and records an audit event", async () => {
    state.rpc.mockResolvedValue({
      data: { updatedIds: [COACH_A], alreadyIds: [], missingIds: [] },
      error: null,
    });
    const result = await bulkSetCoachVerification([COACH_A], "approved");
    expect(result.ok).toBe(true);
    expect(result.message).toBe("1 coach marked as approved.");
    expect(state.rpc).toHaveBeenCalledWith("admin_set_coach_verification", {
      p_coach_ids: [COACH_A],
      p_verified: true,
    });
    expect(state.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "coach.verification_verified",
        targetType: "coach",
        details: expect.objectContaining({
          newState: "approved",
          updatedIds: [COACH_A],
        }),
      })
    );
  });

  it("bulk-unverifies without writing publication fields", async () => {
    state.rpc.mockResolvedValue({
      data: { updatedIds: [COACH_A, COACH_B], alreadyIds: [], missingIds: [] },
      error: null,
    });
    const result = await bulkSetCoachVerification(
      [COACH_A, COACH_B],
      "needs_review"
    );
    expect(result.ok).toBe(true);
    expect(result.message).toBe("2 coaches marked as needs review.");
    expect(state.rpc.mock.calls[0][1]).toEqual({
      p_coach_ids: [COACH_A, COACH_B],
      p_verified: false,
    });
    expect(state.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "coach.verification_unverified" })
    );
  });

  it("unclaims a managed coach and keeps the action scoped to memberships", async () => {
    state.rpc.mockResolvedValue({
      data: { updatedIds: [COACH_B], alreadyIds: [], missingIds: [] },
      error: null,
    });
    const result = await bulkUnclaimCoaches([COACH_B]);
    expect(result.ok).toBe(true);
    expect(result.message).toBe("1 coach made unclaimed.");
    expect(state.rpc).toHaveBeenCalledWith("admin_unclaim_coaches", {
      p_coach_ids: [COACH_B],
    });
    expect(state.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "coach.account_unclaimed" })
    );
  });

  it("reports missing ids instead of pretending every selected coach changed", async () => {
    state.rpc.mockResolvedValue({
      data: {
        updatedIds: [COACH_A],
        alreadyIds: [],
        missingIds: [COACH_B],
      },
      error: null,
    });
    const result = await bulkSetCoachVerification(
      [COACH_A, COACH_B],
      "approved"
    );
    expect(result.ok).toBe(true);
    expect(result.message).toContain("1 coach marked as approved");
    expect(result.message).toContain("1 selected coach was not found");
  });

  it("rejects support admins and signed-out users", async () => {
    state.role = "support";
    await expect(bulkSetCoachVerification([COACH_A], "approved")).resolves.toEqual({
      ok: false,
      message:
        "You need profile management permission to change coach verification or account ownership.",
    });
    expect(state.rpc).not.toHaveBeenCalled();

    state.role = null;
    state.claims = null;
    await expect(bulkUnclaimCoaches([COACH_A])).resolves.toEqual({
      ok: false,
      message: "Sign in to continue.",
    });
  });

  it("rejects invalid ids before calling the database", async () => {
    await expect(
      bulkSetCoachVerification(["not-a-uuid"], "approved")
    ).resolves.toEqual({
      ok: false,
      message: "One or more selected IDs are invalid.",
    });
    expect(state.rpc).not.toHaveBeenCalled();
  });
});

describe("permission helper used by the actions", () => {
  it("keeps profiles.manage on operations/owner only", () => {
    expect(hasAdminPermission({ role: "operations", status: "active" }, "profiles.manage")).toBe(true);
    expect(hasAdminPermission({ role: "support", status: "active" }, "profiles.manage")).toBe(false);
  });
});
