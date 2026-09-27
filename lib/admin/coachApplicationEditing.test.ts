import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasAdminPermission, type AdminRole } from "./permissions";
import {
  updateCoachApplicationApplicantDetails as saveApplicant,
  updateCoachApplicationLocations as saveLocations,
  updateCoachApplicationCoachingProfile as saveProfile,
} from "@/app/admin/(ops)/applications/coach-edit-actions";
import { revalidatePath } from "next/cache";

const state = vi.hoisted(() => ({
  role: "reviewer" as AdminRole | null,
  claims: { sub: "admin-user" } as Record<string, unknown>,
  status: "under_review",
  version: "2026-09-27T10:00:00.000Z",
  rpc: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/adminSession", () => ({
  getAdminAccount: async () =>
    state.role
      ? { id: "admin-user", role: state.role, status: "active" }
      : null,
  accountHasPermission: (
    account: Parameters<typeof hasAdminPermission>[0],
    permission: Parameters<typeof hasAdminPermission>[1],
  ) => hasAdminPermission(account, permission),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getClaims: async () => ({ data: { claims: state.claims }, error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: "application-id",
              status: state.status,
              updated_at: state.version,
            },
            error: null,
          }),
        }),
      }),
    }),
    rpc: state.rpc,
  }),
}));

const version = {
  applicationId: "application-id",
  updatedAt: "2026-09-27T10:00:00.000Z",
};
const details = {
  full_name: "Reviewed Name",
  phone: "+34 123456789",
  coaching_role: "head_coach",
  coaching_role_other: "",
  experience_years: "12",
};
const profile = {
  description: "",
  player_levels: ["advanced"],
  audiences: ["adults"],
  outcomes: ["improve_technique"],
};
const locations = [{ country: "Spain", city: "Madrid", is_primary: true }];
const calls = [
  () => saveApplicant({ ...version, details }),
  () => saveLocations({ ...version, locations }),
  () => saveProfile({ ...version, profile }),
];

beforeEach(() => {
  vi.clearAllMocks();
  state.role = "reviewer";
  state.claims = { sub: "admin-user" };
  state.status = "under_review";
  state.version = version.updatedAt;
  state.rpc.mockResolvedValue({ error: null });
});

describe("card action access and concurrency", () => {
  it.each(["owner", "operations", "reviewer"] as const)(
    "allows %s using the real permission matrix",
    async (role) => {
      state.role = role;
      for (const call of calls) expect((await call()).ok).toBe(true);
      expect(state.rpc).toHaveBeenCalledTimes(3);
    },
  );
  it.each(["support", null] as const)(
    "denies %s on every card",
    async (role) => {
      state.role = role;
      for (const call of calls) expect((await call()).ok).toBe(false);
      expect(state.rpc).not.toHaveBeenCalled();
    },
  );
  it("requires verified claims even when a membership is returned", async () => {
    state.claims = {};
    for (const call of calls) expect((await call()).ok).toBe(false);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it.each(["submitted", "under_review", "changes_requested"])(
    "edits %s",
    async (status) => {
      state.status = status;
      for (const call of calls) expect((await call()).ok).toBe(true);
    },
  );
  it.each(["draft", "approved", "declined", "withdrawn"])(
    "blocks %s",
    async (status) => {
      state.status = status;
      for (const call of calls) expect((await call()).ok).toBe(false);
      expect(state.rpc).not.toHaveBeenCalled();
    },
  );
  it("does not overwrite a newer revision", async () => {
    state.version = "2026-09-27T11:00:00.000Z";
    for (const call of calls)
      expect((await call()).message).toContain("has changed");
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("handles a revision/status race detected inside the transaction", async () => {
    state.rpc.mockResolvedValue({
      error: { code: "40001", message: "private database detail" },
    });
    expect(await calls[0]()).toMatchObject({
      ok: false,
      message: expect.stringContaining("has changed"),
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("explicit card payloads and existing validation", () => {
  it("excludes email, identity, status and coach binding even if supplied", async () => {
    const unsafe = {
      ...details,
      applicant_email: "attacker@example.invalid",
      user_id: "other",
      coach_id: "other",
      target_coach_id: "other",
      status: "approved",
    };
    expect((await saveApplicant({ ...version, details: unsafe })).ok).toBe(
      true,
    );
    expect(state.rpc).toHaveBeenCalledWith(
      "admin_update_coach_application_applicant",
      {
        p_application_id: version.applicationId,
        p_expected_updated_at: version.updatedAt,
        p_full_name: details.full_name,
        p_phone: details.phone,
        p_coaching_role: details.coaching_role,
        p_coaching_role_other: null,
        p_experience_years: 12,
      },
    );
  });
  it.each([
    { full_name: "X" },
    { phone: "123" },
    { coaching_role: "bogus" },
    { experience_years: "61" },
    { experience_years: "2.5" },
    { coaching_role: "other", coaching_role_other: "" },
  ])("rejects invalid applicant details: %j", async (invalid) => {
    expect(
      (await saveApplicant({ ...version, details: { ...details, ...invalid } }))
        .ok,
    ).toBe(false);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("normalizes other role and trims fields", async () => {
    await saveApplicant({
      ...version,
      details: {
        ...details,
        full_name: "  Reviewed Name ",
        coaching_role: "other",
        coaching_role_other: "  Specialist ",
      },
    });
    expect(state.rpc.mock.calls[0][1]).toMatchObject({
      p_full_name: "Reviewed Name",
      p_coaching_role_other: "Specialist",
    });
  });
  it.each([
    [],
    [{ ...locations[0], is_primary: false }],
    [locations[0], { ...locations[0], city: " madrid " }],
    [locations[0], { ...locations[0], city: "Barcelona" }],
    [{ ...locations[0], country: "Invalid" }],
    [{ ...locations[0], city: "X" }],
  ])("rejects invalid location sets: %j", async (...rows) => {
    // it.each spreads each array into positional arguments.
    const candidate = rows as typeof locations;
    expect((await saveLocations({ ...version, locations: candidate })).ok).toBe(
      false,
    );
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("supports replacing, adding and removing locations with one primary", async () => {
    for (const rows of [
      locations,
      [
        ...locations,
        { country: "Spain", city: "Barcelona", is_primary: false },
      ],
      [{ country: "Italy", city: "Rome", is_primary: true }],
    ]) {
      expect((await saveLocations({ ...version, locations: rows })).ok).toBe(
        true,
      );
      expect(state.rpc).toHaveBeenLastCalledWith(
        "admin_update_coach_application_locations",
        expect.objectContaining({ p_locations: rows }),
      );
    }
  });
  it("uses only structured profile fields", async () => {
    await saveProfile({
      ...version,
      profile: { ...profile, applicant_email: "ignored" } as typeof profile,
    });
    expect(state.rpc).toHaveBeenCalledWith(
      "admin_update_coach_application_profile",
      {
        p_application_id: version.applicationId,
        p_expected_updated_at: version.updatedAt,
        p_description: null,
        p_player_levels: profile.player_levels,
        p_audiences: profile.audiences,
        p_outcomes: profile.outcomes,
      },
    );
  });
  it.each([
    { player_levels: ["unknown"] },
    { audiences: [] },
    { outcomes: ["anything"] },
    { description: "Too short" },
  ])("rejects invalid profile: %j", async (invalid) => {
    expect(
      (await saveProfile({ ...version, profile: { ...profile, ...invalid } }))
        .ok,
    ).toBe(false);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("keeps database errors and personal data out of UI/logs", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    state.rpc.mockResolvedValue({
      error: {
        code: "23514",
        message: "private email",
        details: "Failing row contains (...)",
      },
    });
    expect((await calls[0]()).message).not.toContain("private email");
    expect(log).toHaveBeenCalledWith("[coach-application-edit]", {
      action: "admin_update_coach_application_applicant",
      code: "23514",
    });
    log.mockRestore();
  });
});
