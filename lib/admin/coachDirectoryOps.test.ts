import { describe, expect, it } from "vitest";
import { hasAdminPermission } from "@/lib/admin/permissions";
import {
  parseCoachDirectoryIds,
  parseCoachDirectoryRpcResult,
  summarizeCoachUnclaim,
  summarizeCoachVerification,
  unclaimConfirmMessage,
  verificationConfirmMessage,
  verificationDirectoryLabel,
} from "@/lib/admin/coachDirectoryOps";
import { directoryAccountLabel, directoryVerificationLabel } from "@/lib/admin/profileDirectory";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("coach directory verification and account labels", () => {
  it("maps verification from is_approved only", () => {
    expect(directoryVerificationLabel(true)).toBe("Approved");
    expect(directoryVerificationLabel(false)).toBe("Needs review");
    expect(verificationDirectoryLabel("approved")).toBe("Approved");
    expect(verificationDirectoryLabel("needs_review")).toBe("Needs review");
  });

  it("maps account from membership presence only", () => {
    expect(directoryAccountLabel(true)).toBe("Managed");
    expect(directoryAccountLabel(false)).toBe("Unclaimed");
  });
});

describe("coach directory confirmations", () => {
  it("does not require confirmation for mark as approved", () => {
    expect(verificationConfirmMessage(3, "approved")).toBeNull();
  });

  it("confirms unverify without deletion language", () => {
    const message = verificationConfirmMessage(4, "needs_review");
    expect(message).toContain("Mark 4 coaches as needs review?");
    expect(message).toContain("publication status will not be changed");
    expect(message).not.toMatch(/delete/i);
  });

  it("confirms unclaim without deleting accounts or coaches", () => {
    const message = unclaimConfirmMessage(4);
    expect(message).toContain("Make 4 coaches unclaimed?");
    expect(message).toContain("removes account ownership");
    expect(message).toContain("will not be deleted");
    expect(message).not.toMatch(/permanently delete/i);
  });

  it("uses singular nouns for one selected coach", () => {
    expect(verificationConfirmMessage(1, "needs_review")).toContain("Mark 1 coach as needs review?");
    expect(unclaimConfirmMessage(1)).toContain("Make 1 coach unclaimed?");
  });
});

describe("coach directory id parsing and summaries", () => {
  it("rejects invalid and empty selections", () => {
    expect(parseCoachDirectoryIds([])).toEqual({
      ok: false,
      message: "Select at least one profile.",
    });
    expect(parseCoachDirectoryIds(["not-a-uuid"]).ok).toBe(false);
  });

  it("deduplicates valid coach ids", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(parseCoachDirectoryIds([id, id])).toEqual({ ok: true, ids: [id] });
  });

  it("summarises verification and unclaim with missing and already-done counts", () => {
    expect(
      summarizeCoachVerification("approved", {
        updatedIds: ["a", "b"],
        alreadyIds: ["c"],
        missingIds: ["d"],
      })
    ).toBe(
      "2 coaches marked as approved. 1 was already approved. 1 selected coach was not found."
    );
    expect(
      summarizeCoachUnclaim({
        updatedIds: ["a"],
        alreadyIds: ["b", "c"],
        missingIds: [],
      })
    ).toBe("1 coach made unclaimed. 2 were already unclaimed.");
  });

  it("parses RPC jsonb with camelCase or snake_case keys", () => {
    expect(
      parseCoachDirectoryRpcResult({
        updated_ids: ["a"],
        alreadyIds: ["b"],
        missingIds: [],
      })
    ).toEqual({
      updatedIds: ["a"],
      alreadyIds: ["b"],
      missingIds: [],
    });
  });
});

describe("coach directory permissions", () => {
  it("allows profiles.manage and rejects support, reviewer and ordinary users", () => {
    expect(
      hasAdminPermission({ role: "operations", status: "active" }, "profiles.manage")
    ).toBe(true);
    expect(
      hasAdminPermission({ role: "owner", status: "active" }, "profiles.manage")
    ).toBe(true);
    expect(
      hasAdminPermission({ role: "support", status: "active" }, "profiles.manage")
    ).toBe(false);
    expect(
      hasAdminPermission({ role: "reviewer", status: "active" }, "profiles.manage")
    ).toBe(false);
    expect(hasAdminPermission(null, "profiles.manage")).toBe(false);
  });
});

describe("coach directory actions stay decoupled from publication and Pass 2", () => {
  it("does not write publication, membership fakes, or use service-role", () => {
    const actions = read("app/admin/(ops)/coachDirectoryActions.ts");
    const migration = read(
      "supabase/migrations/20260927224957_admin_coach_directory_bulk_ops.sql"
    );
    expect(actions).toContain('hasAdminPermission(account, "profiles.manage")');
    expect(actions).toContain("admin_set_coach_verification");
    expect(actions).toContain("admin_unclaim_coaches");
    expect(actions).toContain("coach.verification_verified");
    expect(actions).toContain("coach.verification_unverified");
    expect(actions).toContain("coach.account_unclaimed");
    expect(actions).not.toContain("getSupabaseAdmin");
    expect(actions).not.toContain("service_role");
    expect(actions).not.toMatch(/publication_status\s*:/);
    expect(actions).not.toMatch(/is_claimed\s*:/);
    expect(migration).toContain("profiles.manage");
    expect(migration).toContain("delete from public.coach_memberships");
    expect(migration).not.toContain("publication_status =");
    expect(migration).not.toContain("delete from public.profiles");
    expect(migration).not.toContain("delete from auth.users");
    expect(migration).not.toContain("delete from public.coaches");
  });

  it("exposes coach-only action groups and does not touch Pass 2 migration", () => {
    const directory = read("components/admin/AdminProfileDirectory.tsx");
    expect(directory).toContain('label="Verification"');
    expect(directory).toContain("Mark as approved");
    expect(directory).toContain("Mark as needs review");
    expect(directory).toContain("Make unclaimed");
    expect(directory).not.toContain("Make managed");
    expect(directory).toContain('kind === "coach"');
    expect(directory).toContain("bulkSetCoachVerification");
    expect(directory).toContain("bulkUnclaimCoaches");
    expect(directory).toContain("bulkPublishProfiles");

    const pass2 = read(
      "supabase/migrations/20260927185846_coach_application_inline_review_edits.sql"
    );
    expect(pass2).not.toContain("admin_set_coach_verification");
    expect(pass2).not.toContain("admin_unclaim_coaches");
  });
});
