import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CoachProfileApplicationRow } from "./types";

const ROOT = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(ROOT, relativePath), "utf8").replace(
    /\r\n/g,
    "\n"
  );
}

const USER_ID = "05026e0f-0000-4000-8000-000000000001";
const APPLICATION_ID = "ecaa829a-0000-4000-8000-000000000002";
const VERIFIED_EMAIL = "verified-draft-owner@example.invalid";

/** Live columns of public.coach_profile_applications. */
const COACH_APPLICATION_COLUMNS = new Set([
  "id",
  "user_id",
  "status",
  "current_step",
  "full_name",
  "phone",
  "coaching_role",
  "coaching_role_other",
  "experience_years",
  "description",
  "player_levels",
  "audiences",
  "outcomes",
  "terms_accepted_at",
  "privacy_accepted_at",
  "submitted_at",
  "coach_id",
  "created_at",
  "updated_at",
  "reviewed_at",
  "reviewed_by_user_id",
  "review_note",
  "application_mode",
  "target_coach_id",
  "applicant_email",
  "owns_or_manages_venue",
]);

type Claims = Record<string, unknown>;
type UpdateResult = {
  error: null | { code: string; message: string; details: string | null; hint: string | null };
};

const harness = {
  claims: {} as Claims,
  updatePayloads: [] as Array<Record<string, unknown>>,
  updateResult: { error: null } as UpdateResult,
};

function thenableChain(result: UpdateResult) {
  const chain = {
    eq: () => chain,
    then: (resolve: (value: UpdateResult) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  return chain;
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getClaims: vi.fn(async () => ({
        data: { claims: harness.claims },
        error: null,
      })),
    },
    from: vi.fn(() => ({
      update: (payload: Record<string, unknown>) => {
        harness.updatePayloads.push(payload);
        return thenableChain(harness.updateResult);
      },
    })),
  })),
}));
vi.mock("@/lib/queries/coachProfileApplication", () => ({
  loadOwnedApplication: vi.fn(async () => draft()),
  loadApplicationLocations: vi.fn(async () => [
    {
      id: "loc-1",
      application_id: APPLICATION_ID,
      country: "Spain",
      city: "Madrid",
      is_primary: true,
      created_at: "2026-09-25T00:00:00.000Z",
    },
  ]),
  loadCurrentCoachApplication: vi.fn(),
  loadOwnedEditableApplication: vi.fn(),
}));
vi.mock("@/lib/notifications/applicationEmails", () => ({
  sendCoachApplicationStatusEmail: vi.fn(async () => undefined),
}));

function draft(): CoachProfileApplicationRow {
  return {
    id: APPLICATION_ID,
    user_id: USER_ID,
    status: "draft",
    current_step: 4,
    application_mode: "create_new",
    target_coach_id: null,
    applicant_email: VERIFIED_EMAIL,
    full_name: "Draft Owner",
    phone: "123456789",
    coaching_role: "padel_coach",
    coaching_role_other: null,
    experience_years: 3,
    description: null,
    player_levels: ["beginner"],
    audiences: ["adults"],
    outcomes: ["learn_fundamentals"],
    terms_accepted_at: null,
    privacy_accepted_at: null,
    submitted_at: null,
    coach_id: null,
    reviewed_at: null,
    reviewed_by_user_id: null,
    review_note: null,
    created_at: "2026-09-25T00:00:00.000Z",
    updated_at: "2026-09-25T00:00:00.000Z",
  };
}

async function submit() {
  const { submitCoachApplication } = await import(
    "@/app/account/applications/coach/actions"
  );
  return submitCoachApplication({
    applicationId: APPLICATION_ID,
    termsAccepted: true,
    privacyAccepted: true,
  });
}

describe("submitCoachApplication", () => {
  beforeEach(() => {
    harness.claims = { sub: USER_ID, role: "authenticated" };
    harness.updatePayloads = [];
    harness.updateResult = { error: null };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("submits an existing draft when the JWT has no email claim", async () => {
    const result = await submit();

    expect(result.status).toBe("success");
    expect(harness.updatePayloads).toHaveLength(1);

    const payload = harness.updatePayloads[0];
    expect(payload.status).toBe("submitted");
    expect(payload.current_step).toBe(4);
    expect(payload).not.toHaveProperty("applicant_email");
    expect(payload).not.toHaveProperty("applicationId");

    // Every key must be a real column: PostgREST answers PGRST204 (400)
    // for unknown keys before any trigger or RLS policy runs.
    for (const key of Object.keys(payload)) {
      expect(COACH_APPLICATION_COLUMNS.has(key), `unknown column ${key}`).toBe(
        true
      );
    }
  });

  it("only writes applicant_email when the session carries an email claim", async () => {
    harness.claims = {
      sub: USER_ID,
      role: "authenticated",
      email: " Owner@Example.invalid ",
    };

    const result = await submit();

    expect(result.status).toBe("success");
    expect(harness.updatePayloads[0].applicant_email).toBe(
      "Owner@Example.invalid"
    );
  });

  it("keeps the browser message generic while logging the real Supabase error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    harness.updateResult = {
      error: {
        code: "PGRST204",
        message:
          "Could not find the 'applicationId' column of 'coach_profile_applications' in the schema cache",
        details: null,
        hint: null,
      },
    };

    const result = await submit();

    expect(result).toEqual({
      status: "error",
      message: "We could not submit your application. Please try again shortly.",
      fieldErrors: {},
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [scope, payload] = errorSpy.mock.calls[0];
    expect(scope).toBe("[applications] submitCoachApplication failed");
    expect(payload).toMatchObject({
      applicationId: APPLICATION_ID,
      userId: USER_ID,
      code: "PGRST204",
      hint: null,
    });
    expect(String((payload as { message: string }).message)).toContain(
      "applicationId"
    );
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(VERIFIED_EMAIL);
  });
});

describe("application submit payloads", () => {
  for (const relativePath of [
    "app/account/applications/coach/actions.ts",
    "app/account/applications/venue/actions.ts",
  ]) {
    it(`${relativePath} never sends non-column keys in update payloads`, () => {
      const source = read(relativePath);
      const updateBodies = [...source.matchAll(/\.update\(\{([\s\S]*?)\}\)/g)].map(
        (match) => match[1]
      );
      expect(updateBodies.length).toBeGreaterThan(0);
      for (const body of updateBodies) {
        expect(body).not.toMatch(/\bapplicationId\b/);
      }
    });
  }
});

describe("application email claim fallback migration", () => {
  const migration = read(
    "supabase/migrations/20260926000000_application_email_claim_fallback.sql"
  );
  const harnessCopy = read("supabase/tests/sprint6a_disposable_harness.sql");

  it("falls back to the verified draft email only for owner updates", () => {
    expect(migration).toContain(
      "create or replace function private.prepare_application_notification_email()"
    );
    expect(migration).toContain("if caller_id is not null and caller_id = new.user_id then");
    expect(migration).toContain("if caller_email is null and tg_op = 'UPDATE' then");
    expect(migration).toContain(
      "caller_email := lower(nullif(btrim(old.applicant_email), ''));"
    );
    expect(migration).toContain("new.applicant_email := caller_email;");
  });

  it("keeps the insert requirement and reviewer protections", () => {
    expect(migration).toContain(
      "raise exception 'A verified account email is required.' using errcode = '23514';"
    );
    expect(migration).toContain(
      "elsif tg_op = 'UPDATE' and new.applicant_email is distinct from old.applicant_email then"
    );
    expect(migration).toContain(
      "raise exception 'Applicant email cannot be changed by reviewers.' using errcode = '42501';"
    );
    expect(migration).toContain("new.applicant_email := old.applicant_email;");
    expect(migration).not.toMatch(/security definer/i);
  });

  it("is mirrored by the disposable harness", () => {
    expect(harnessCopy).toContain(
      "caller_email := lower(nullif(btrim(old.applicant_email), ''));"
    );
    expect(harnessCopy).toContain("if caller_email is null and tg_op = 'UPDATE' then");
  });
});
