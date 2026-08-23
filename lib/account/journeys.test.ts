import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { signupPageCopy, isPartnerSignupPath } from "@/lib/auth/signupCopy";

const ROOT = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("signup copy", () => {
  it("is player-focused by default", () => {
    const copy = signupPageCopy("/account");
    expect(copy.description).toMatch(/player account/i);
    expect(copy.description).not.toMatch(
      /One account for your padel profile, coaches, and venues/
    );
    expect(isPartnerSignupPath("/account")).toBe(false);
  });

  it("can use partner context when signup is reached from an application", () => {
    expect(isPartnerSignupPath("/account/applications/coach")).toBe(true);
    expect(signupPageCopy("/account/applications/venue").description).toMatch(
      /academy or venue/i
    );
  });
});

describe("player and partner journey pages", () => {
  it("keeps /signup as the player registration endpoint", () => {
    const source = read("app/signup/page.tsx");
    expect(source).toContain("signupPageCopy");
    expect(source).toContain('from "@/lib/auth/signupCopy"');
    expect(source).not.toContain(
      "One account for your padel profile, coaches, and venues."
    );
  });

  it("keeps /join partner-specific and points players to /signup", () => {
    const source = read("app/join/page.tsx");
    expect(source).toContain("Partner with Padel Pathways");
    expect(source).toContain("Individual coach");
    expect(source).toContain("Academy / Venue");
    expect(source).toContain("Travel Partner");
    expect(source).toContain('href="/signup"');
    expect(source).toContain("Create a player account");
    expect(source).not.toContain("claim_existing");
  });

  it("exposes create player account and join as a partner in public navigation", () => {
    const header = read("components/AppHeader.tsx");
    expect(header).toContain('href="/signup"');
    expect(header).toContain("Create player account");
    expect(header).toContain('href="/join"');
    expect(header).toContain("Join as a partner");
    expect(header).not.toContain("Join PadelPathways");
  });

  it("does not show prominent coach/venue start cards on the player dashboard", () => {
    const personal = read("app/account/personal/page.tsx");
    expect(personal).toContain("buildPersonalDashboardView");
    expect(personal).not.toContain("Start coach application");
    expect(personal).not.toContain("Start venue application");
    expect(personal).toContain("Become a Padel Pathways partner");
    expect(personal).toContain('href="/join"');
    expect(personal).toContain("view.playerCtas");

    const empty = read("components/account/EmptyAccountState.tsx");
    expect(empty).toContain("Ready to find your next coach?");
    expect(empty).not.toContain("No managed profiles yet");
    expect(empty).toContain('href="/coaches"');

    const view = read("lib/account/personalDashboard.ts");
    expect(view).toContain('href: "/coaches"');
    expect(view).toContain("showCoachStartCard: false");
    expect(view).toContain("showVenueStartCard: false");
  });

  it("reads account_journey in loadAccountDashboard without using it for authorization", () => {
    const source = read("lib/queries/accountDashboard.ts");
    expect(source).toContain("account_journey");
    expect(source).toContain("accountJourney");
    expect(source).toContain("isAccountJourney");
    expect(source).toContain('UX hint only');
  });
});

describe("admin profile directory pages", () => {
  it("lists coaches without public publication filters and links to lifecycle pages", () => {
    const page = read("app/admin/(ops)/coaches/page.tsx");
    const queries = read("lib/admin/profileDirectoryQueries.ts");
    expect(page).toContain("listAdminCoachDirectory");
    expect(page).toContain('basePath="/admin/coaches"');
    expect(queries).toContain("from(\"coaches\")");
    expect(queries).not.toContain("applyPublishedCoachFilter");
    expect(queries).not.toContain("publicationFilters");
    expect(queries).toContain("private imported profiles must remain visible");
    expect(queries).toContain('requireAdminPermission("profiles.read")');
  });

  it("lists venues with the same architecture and existing detail links", () => {
    const page = read("app/admin/(ops)/venues/page.tsx");
    const queries = read("lib/admin/profileDirectoryQueries.ts");
    expect(page).toContain("listAdminVenueDirectory");
    expect(page).toContain('basePath="/admin/venues"');
    expect(queries).toContain("from(\"venues\")");
    expect(queries).not.toContain("applyPublishedVenueFilter");
  });

  it("gates overview coach/venue cards on profiles.read", () => {
    const overview = read("app/admin/(ops)/page.tsx");
    expect(overview).toContain('hasAdminPermission(account, "profiles.read")');
    expect(overview).toContain('href="/admin/coaches"');
    expect(overview).toContain('href="/admin/venues"');
    expect(overview).toContain("loadAdminProfileDirectoryStats");
  });
});
