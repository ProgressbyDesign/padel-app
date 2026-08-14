import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..", "..");

/**
 * Approval is a data-quality decision; publication is a launch decision.
 * These guards fail if an approval path ever starts writing lifecycle columns.
 */
const APPROVAL_SOURCES = [
  "app/admin/(ops)/applications/coach-actions.ts",
  "app/admin/(ops)/applications/venue-actions.ts",
];

const LIFECYCLE_WRITE_PATTERNS = [
  /publication_status\s*:/,
  /launch_selection_status\s*:/,
  /published_at\s*:/,
  /published_by_user_id\s*:/,
  /selected_at\s*:/,
  /selected_by_user_id\s*:/,
];

describe("approval never auto-publishes", () => {
  for (const relativePath of APPROVAL_SOURCES) {
    it(`${relativePath} does not write lifecycle columns`, () => {
      const source = readFileSync(path.join(ROOT, relativePath), "utf8");
      for (const pattern of LIFECYCLE_WRITE_PATTERNS) {
        expect(pattern.test(source), `${pattern} matched`).toBe(false);
      }
    });
  }

  it("admin lifecycle actions never populate trigger-owned audit fields", () => {
    const source = readFileSync(
      path.join(ROOT, "app/admin/(ops)/coaches/[coachId]/actions.ts"),
      "utf8"
    );
    expect(/published_at\s*:/.test(source)).toBe(false);
    expect(/published_by_user_id\s*:/.test(source)).toBe(false);
    expect(/selected_at\s*:/.test(source)).toBe(false);
    expect(/selected_by_user_id\s*:/.test(source)).toBe(false);
    expect(source).toContain('requireAdminPermission("profiles.manage"');
    expect(source).not.toContain("service_role");
    expect(source).not.toContain("SERVICE_ROLE");
  });
});
