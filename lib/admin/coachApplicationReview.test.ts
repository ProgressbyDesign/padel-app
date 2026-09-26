import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  APPROVE_CLAIM_LABEL,
  APPROVE_COACH_LABEL,
  COACH_APPROVED_MESSAGE,
  coachApprovalOutcomeMessage,
} from "./coachApprovalCopy";

const ROOT = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(ROOT, relativePath), "utf8").replace(/\r\n/g, "\n");
}

describe("approval copy is truthful to the lifecycle", () => {
  it("never describes the approval action as publishing", () => {
    expect(APPROVE_COACH_LABEL).toBe("Approve coach");
    expect(APPROVE_CLAIM_LABEL).not.toMatch(/publish/i);
    expect(COACH_APPROVED_MESSAGE).toBe("Coach application approved.");
  });

  it("derives the outcome sentence from the coach's real publication status", () => {
    expect(coachApprovalOutcomeMessage("published")).toContain("is published on the website");
    expect(coachApprovalOutcomeMessage("private")).toContain(
      "publish the profile when it is ready"
    );
    expect(coachApprovalOutcomeMessage(null)).not.toMatch(/is published/);
  });

  it("actions and panel carry no hard-coded 'publish' success wording", () => {
    for (const file of [
      "app/admin/(ops)/applications/coach-actions.ts",
      "components/admin/CoachApplicationReviewPanel.tsx",
    ]) {
      const source = read(file);
      expect(source, file).not.toMatch(/approved and coach published/i);
      expect(source, file).not.toMatch(/approve and publish/i);
      expect(source, file).not.toMatch(/approve claim and publish/i);
      expect(source, file).not.toMatch(/Create, approve and publish/i);
    }
  });
});

describe("review starts automatically on the detail page only", () => {
  const detailPage = read("app/admin/(ops)/applications/coaches/[applicationId]/page.tsx");
  const queuePage = read("app/admin/(ops)/applications/coaches/page.tsx");
  const helper = read("lib/admin/coachApplicationReview.ts");
  const panel = read("components/admin/CoachApplicationReviewPanel.tsx");

  it("detail page opens the review; queue and panel do not", () => {
    expect(detailPage).toContain("beginCoachApplicationReviewOnOpen(detail.application)");
    expect(queuePage).not.toContain("beginCoachApplicationReviewOnOpen");
    expect(panel).not.toContain("startCoachApplicationReview");
    expect(panel).not.toContain("Start review");
  });

  it("queue links opt out of prefetching so previews never mutate", () => {
    const detailLinks = queuePage.match(
      /href=\{`\/admin\/applications\/coaches\/\$\{application\.id\}`\}\s*\n\s*prefetch=\{false\}/g
    );
    expect(detailLinks?.length).toBe(2);
  });

  it("helper is permission-gated and compare-and-set on submitted", () => {
    expect(helper).toContain('accountHasPermission(account, "applications.review")');
    expect(helper).toContain('.update({ status: "under_review" })');
    expect(helper).toContain('.eq("status", "submitted")');
    expect(helper).not.toContain("revalidatePath");
  });
});

describe("simplified review panel", () => {
  const panel = read("components/admin/CoachApplicationReviewPanel.tsx");
  const actions = read("app/admin/(ops)/applications/coach-actions.ts");

  it("offers one approval action per mode and no permanent search/create forms", () => {
    expect(panel).toContain("APPROVE_COACH_LABEL");
    expect(panel).toContain("APPROVE_CLAIM_LABEL");
    expect(panel).not.toContain("Approve with existing coach");
    expect(panel).not.toContain("Create and approve coach");
    expect(panel).not.toContain("searchCoachesForApprovalAction");
  });

  it("shows duplicate resolution only from the action result", () => {
    expect(panel).toContain("result.duplicateCandidates");
    expect(panel).toContain("Use existing profile");
    expect(panel).toContain("Create separate coach");
    expect(panel).toContain("createSeparateCoach: true");
  });

  it("approval actions keep admin permission checks, emails and audit events", () => {
    expect(actions).toContain('requireAdminPermission("applications.review", "not-found")');
    expect(actions).toContain('requireAdminPermission("profiles.manage", "not-found")');
    expect(actions).toContain('action: "coach_application.approved"');
    expect(actions).toContain('action: "coach_application.declined"');
    expect(actions).toContain('action: "coach_application.changes_requested"');
    expect(actions).toContain("sendCoachApplicationStatusEmail");
    expect(actions).toContain("findPossibleDuplicateCoaches");
    expect(read("lib/admin/applicationQueries.ts")).toContain("duplicateRetrievalFilters");
    expect(actions).toContain("createSeparateCoach");
    expect(actions).not.toContain("service_role");
  });

  it("refuses to attach an applicant to a profile another account manages", () => {
    expect(actions).toContain('.neq("user_id", application.user_id)');
    expect(actions).toContain("already managed by another account");
  });
});

describe("approval trigger migration preserves existing coaches", () => {
  const migration = read(
    "supabase/migrations/20260926120000_separate_coach_approval_from_publication.sql"
  );

  it("fills gaps for create_new approvals and keeps claim behaviour", () => {
    expect(migration).toContain(
      "create or replace function private.finalize_approved_coach_application()"
    );
    expect(migration).toContain("if new.application_mode = 'claim_existing' then");
    expect(migration).toContain(
      "set name = coalesce(nullif(btrim(name), ''), btrim(new.full_name))"
    );
    expect(migration).toContain("on conflict (coach_id) do nothing;");
    expect(migration).toContain(
      "select 1 from public.coach_locations location\n        where location.coach_id = new.coach_id"
    );
    expect(migration).toContain("insert into public.coach_memberships (coach_id, user_id, membership_role)");
  });

  it("does not publish the coach as part of approval", () => {
    expect(migration).not.toMatch(/publication_status\s*=\s*'published'/);
  });

  it("adds a read-only reviewer policy for application locations", () => {
    expect(migration).toContain(
      'create policy "Reviewers and support can view coach application locations"'
    );
    expect(migration).toContain("for select");
    expect(migration).toContain("using (private.has_admin_permission('applications.read'))");
    expect(migration).not.toMatch(/for (insert|update|delete|all)/i);
  });
});
