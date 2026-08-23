import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hasAdminPermission } from "@/lib/admin/permissions";

const ROOT = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("publication permission matrix", () => {
  it("lets profiles.manage publish and keeps profiles.read view-only", () => {
    expect(
      hasAdminPermission({ role: "operations", status: "active" }, "profiles.read")
    ).toBe(true);
    expect(
      hasAdminPermission(
        { role: "operations", status: "active" },
        "profiles.manage"
      )
    ).toBe(true);
    expect(
      hasAdminPermission({ role: "reviewer", status: "active" }, "profiles.read")
    ).toBe(true);
    expect(
      hasAdminPermission({ role: "reviewer", status: "active" }, "profiles.manage")
    ).toBe(false);
    expect(
      hasAdminPermission({ role: "support", status: "active" }, "profiles.manage")
    ).toBe(false);
    expect(hasAdminPermission(null, "profiles.manage")).toBe(false);
  });
});

describe("shared publication actions", () => {
  const source = read("app/admin/(ops)/publicationActions.ts");

  it("requires authenticated profiles.manage and never uses service-role", () => {
    expect(source).toContain("getAdminAccount");
    expect(source).toContain('hasAdminPermission(account, "profiles.manage")');
    expect(source).toContain("createClient");
    expect(source).not.toContain("getSupabaseAdmin");
    expect(source).not.toContain("service_role");
    expect(source).not.toContain("SERVICE_ROLE");
    expect(source).not.toContain("canPublishForLaunch");
    expect(source).not.toMatch(/launch_selection_status\s*:/);
  });

  it("publishes coaches and venues through the same actions", () => {
    expect(source).toContain('tableForPublicationKind(kind)');
    expect(source).toContain("export async function publishProfile");
    expect(source).toContain("export async function unpublishProfile");
    expect(source).toContain("export async function bulkPublishProfiles");
    expect(source).toContain("export async function bulkUnpublishProfiles");
    expect(source).toContain('kind === "coach"');
    expect(source).toContain('kind === "venue"');
  });

  it("revalidates public and admin surfaces after publication changes", () => {
    expect(source).toContain('revalidatePath("/")');
    expect(source).toContain('revalidatePath("/coaches")');
    expect(source).toContain('revalidatePath("/admin/coaches")');
    expect(source).toContain("`/coach/${id}`");
    expect(source).toContain('revalidatePath("/venues")');
    expect(source).toContain('revalidatePath("/admin/venues")');
    expect(source).toContain("`/venue/${id}`");
  });
});

describe("operational publication UI", () => {
  it("shows a single contextual publish/unpublish control on coach and venue pages", () => {
    const coach = read("app/admin/(ops)/coaches/[coachId]/page.tsx");
    const venue = read("app/admin/(ops)/venues/[venueId]/page.tsx");
    expect(coach).toContain("AdminPublicationControls");
    expect(venue).toContain("AdminPublicationControls");
    expect(coach).toContain('kind="coach"');
    expect(venue).toContain('kind="venue"');
    expect(coach).toContain("Draft profiles remain hidden until an administrator publishes them.");
    expect(venue).toContain("Draft profiles remain hidden until an administrator publishes them.");
    expect(coach).not.toContain("selects them for launch");
    expect(venue).not.toContain("Read-only in this sprint");
    expect(coach).not.toContain("AdminCoachLaunchControls");
  });

  it("directory has page-level checkbox selection and no launch column", () => {
    const directory = read("components/admin/AdminProfileDirectory.tsx");
    expect(directory).toContain('type="checkbox"');
    expect(directory).toContain("Select all profiles on this page");
    expect(directory).toContain("applySelectAllPage");
    expect(directory).toContain("bulkPublishProfiles");
    expect(directory).toContain("bulkUnpublishProfiles");
    expect(directory).toContain(">Status<");
    expect(directory).not.toContain(">Launch<");
    expect(directory).not.toContain(">Visibility<");
    expect(directory).not.toContain("directoryLaunchLabel");
    expect(directory).not.toMatch(/filter === "selected"|filter === "unselected"/);
  });
});
