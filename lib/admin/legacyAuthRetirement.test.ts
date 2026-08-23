import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { redirectedAdminPath } from "@/lib/admin/legacyAdminRedirect";

const ROOT = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function walkFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      files.push(...walkFiles(full));
    } else if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function isClientModule(source: string) {
  return /(?:^|\n)["']use client["']/.test(source);
}

describe("legacy admin path redirects", () => {
  it("does not send operational coach/venue directories to data-quality", () => {
    expect(redirectedAdminPath("/admin/coaches")).toBeNull();
    expect(redirectedAdminPath("/admin/venues")).toBeNull();
    expect(redirectedAdminPath("/admin/coaches/abc")).toBeNull();
    expect(redirectedAdminPath("/admin/venues/abc")).toBeNull();
  });

  it("still maps old crawler bookmarks into data-quality", () => {
    expect(redirectedAdminPath("/admin/review-queue")).toBe(
      "/admin/data-quality/review-queue"
    );
    expect(redirectedAdminPath("/admin/coach-venue-links")).toBe(
      "/admin/data-quality/coach-venue-links"
    );
  });

  it("retires the shared-secret login URLs", () => {
    expect(redirectedAdminPath("/admin/data-quality/login")).toBe(
      "/admin/data-quality"
    );
    expect(redirectedAdminPath("/admin/login")).toBe("/login");
  });
});

describe("ADMIN_SECRET retirement", () => {
  it("does not enforce ADMIN_SECRET in the root proxy", () => {
    const source = read("proxy.ts");
    expect(source).toContain("updateSession");
    expect(source).not.toMatch(/ADMIN_SECRET/);
    expect(source).not.toMatch(/ADMIN_COOKIE|pp_admin_token/);
    expect(source).not.toContain('"/admin/coaches"');
    expect(source).not.toContain('"/admin/venues"');
  });

  it("gates Data Quality on Owner membership, not a second password", () => {
    const layout = read("app/admin/data-quality/(panel)/layout.tsx");
    expect(layout).toContain("requireDataQualityNavAccess");
    expect(layout).not.toMatch(/ADMIN_SECRET|isAdminAuthenticated|pp_admin_token/);

    const login = read("app/admin/data-quality/login/page.tsx");
    expect(login).toContain('redirect("/admin/data-quality")');
    expect(login).not.toContain("AdminLoginForm");
    expect(login).not.toMatch(/ADMIN_SECRET/);

    expect(existsSync(path.join(ROOT, "components/admin/AdminLoginForm.tsx"))).toBe(
      false
    );
    expect(existsSync(path.join(ROOT, "lib/admin/auth.ts"))).toBe(false);
  });

  it("does not ask for ADMIN_SECRET in active admin UI", () => {
    const shell = read("components/admin/AdminShell.tsx");
    expect(shell).not.toMatch(/ADMIN_SECRET/);
    expect(shell).not.toContain("Replace shared-secret auth");
    expect(shell).not.toContain("adminLogout");
    expect(shell).not.toContain("adminLogin");

    const actions = read("app/actions/admin.ts");
    expect(actions).toContain("requireDataQualityAdmin");
    expect(actions).toContain("canAccessDataQuality");
    expect(actions).not.toMatch(/ADMIN_SECRET|adminLogin|adminLogout|pp_admin_token/);
    expect(actions).toContain("getSupabaseAdmin");

    const session = read("lib/auth/adminSession.ts");
    expect(session).toContain("requireDataQualityNavAccess");
    expect(session).toContain("canAccessDataQuality");
    expect(session).toContain('redirect("/admin/section-denied?permission=data-quality")');
    expect(session).not.toMatch(/isAdminAuthenticated|pp_admin_token/);
  });

  it("authorizes operational coach/venue directories with profiles.read", () => {
    const queries = read("lib/admin/profileDirectoryQueries.ts");
    expect(queries).toContain('requireAdminPermission("profiles.read")');
    expect(queries).toContain("listAdminCoachDirectory");
    expect(queries).toContain("listAdminVenueDirectory");
  });

  it("never passes the service-role key to client components", () => {
    const roots = [
      path.join(ROOT, "components"),
      path.join(ROOT, "app"),
    ];
    const clientFiles = roots.flatMap(walkFiles).filter((file) =>
      isClientModule(readFileSync(file, "utf8"))
    );
    expect(clientFiles.length).toBeGreaterThan(0);

    for (const file of clientFiles) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
      expect(source, file).not.toMatch(/getSupabaseAdmin/);
      expect(source, file).not.toMatch(/ADMIN_SECRET/);
      expect(source, file).not.toMatch(/NEXT_PUBLIC_.*SERVICE_ROLE/);
    }
  });
});
