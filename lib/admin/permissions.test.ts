import { describe, expect, it } from "vitest";
import {
  generateInvitationToken,
  hashInvitationToken,
  invitationAcceptPath,
  isValidInvitationRawToken,
  maskEmail,
  normalizeInvitationEmail,
} from "@/lib/admin/invitationToken";
import {
  canChangeMemberRole,
  canSuspendOrRevokeMember,
  countActiveOwners,
} from "@/lib/admin/ownerSafety";
import {
  ADMIN_PERMISSIONS,
  hasAdminPermission,
  listPermissionsForRole,
  navItemsForMembership,
  permissionForAdminPath,
  ROLE_PERMISSIONS,
} from "@/lib/admin/permissions";
import { sanitizeAuditDetails } from "@/lib/admin/audit";
import { safeInternalPath } from "@/lib/auth/safePath";

describe("admin permission matrix", () => {
  it("owner has all permissions", () => {
    for (const permission of ADMIN_PERMISSIONS) {
      expect(
        hasAdminPermission({ role: "owner", status: "active" }, permission)
      ).toBe(true);
    }
    expect(listPermissionsForRole("owner")).toHaveLength(ADMIN_PERMISSIONS.length);
  });

  it("operations lacks team.manage and audit.read", () => {
    const membership = { role: "operations" as const, status: "active" as const };
    expect(hasAdminPermission(membership, "team.manage")).toBe(false);
    expect(hasAdminPermission(membership, "audit.read")).toBe(false);
    expect(hasAdminPermission(membership, "applications.review")).toBe(true);
    expect(hasAdminPermission(membership, "relationships.manage")).toBe(true);
    expect(hasAdminPermission(membership, "bookings.manage")).toBe(true);
  });

  it("reviewer can review applications but cannot manage relationships", () => {
    const membership = { role: "reviewer" as const, status: "active" as const };
    expect(hasAdminPermission(membership, "applications.review")).toBe(true);
    expect(hasAdminPermission(membership, "relationships.manage")).toBe(false);
    expect(hasAdminPermission(membership, "bookings.read")).toBe(false);
    expect(hasAdminPermission(membership, "profiles.manage")).toBe(false);
  });

  it("support is read-only", () => {
    const membership = { role: "support" as const, status: "active" as const };
    expect(hasAdminPermission(membership, "applications.read")).toBe(true);
    expect(hasAdminPermission(membership, "applications.review")).toBe(false);
    expect(hasAdminPermission(membership, "relationships.manage")).toBe(false);
    expect(hasAdminPermission(membership, "bookings.manage")).toBe(false);
    expect(hasAdminPermission(membership, "profiles.manage")).toBe(false);
    expect(hasAdminPermission(membership, "deletions.manage")).toBe(false);
    expect(hasAdminPermission(membership, "team.manage")).toBe(false);
  });

  it("suspended and revoked have no access", () => {
    expect(
      hasAdminPermission({ role: "owner", status: "suspended" }, "admin.access")
    ).toBe(false);
    expect(
      hasAdminPermission({ role: "owner", status: "revoked" }, "admin.access")
    ).toBe(false);
    expect(hasAdminPermission(null, "admin.access")).toBe(false);
  });

  it("TypeScript matrix mirrors expected DB role model", () => {
    expect(ROLE_PERMISSIONS.owner).toEqual(expect.arrayContaining([...ADMIN_PERMISSIONS]));
    expect(ROLE_PERMISSIONS.operations).not.toContain("team.manage");
    expect(ROLE_PERMISSIONS.operations).not.toContain("audit.read");
    expect(ROLE_PERMISSIONS.reviewer).toContain("applications.review");
    expect(ROLE_PERMISSIONS.support).not.toContain("applications.review");
  });

  it("nav items respect role", () => {
    const ownerHrefs = navItemsForMembership({
      role: "owner",
      status: "active",
    }).map((i) => i.href);
    expect(ownerHrefs).toContain("/admin/team");
    expect(ownerHrefs).toContain("/admin/audit");
    expect(ownerHrefs).toContain("/admin/data-quality");

    const opsHrefs = navItemsForMembership({
      role: "operations",
      status: "active",
    }).map((i) => i.href);
    expect(opsHrefs).not.toContain("/admin/team");
    expect(opsHrefs).not.toContain("/admin/audit");
    expect(opsHrefs).not.toContain("/admin/data-quality");
    expect(opsHrefs).toContain("/admin/bookings");

    const reviewerHrefs = navItemsForMembership({
      role: "reviewer",
      status: "active",
    }).map((i) => i.href);
    expect(reviewerHrefs).not.toContain("/admin/bookings");
    expect(reviewerHrefs).toContain("/admin/relationships");

    const supportHrefs = navItemsForMembership({
      role: "support",
      status: "active",
    }).map((i) => i.href);
    expect(supportHrefs).toContain("/admin/account-deletions");
    expect(supportHrefs).not.toContain("/admin/team");
  });

  it("maps routes to permissions", () => {
    expect(permissionForAdminPath("/admin")).toBe("admin.access");
    expect(permissionForAdminPath("/admin/team")).toBe("team.manage");
    expect(permissionForAdminPath("/admin/audit")).toBe("audit.read");
    expect(permissionForAdminPath("/admin/bookings")).toBe("bookings.read");
    expect(permissionForAdminPath("/admin/data-quality")).toBe("data-quality-owner");
  });
});

describe("invitation tokens", () => {
  it("generates secure raw token distinct from digest", () => {
    const a = generateInvitationToken();
    const b = generateInvitationToken();
    expect(a.rawToken).not.toBe(b.rawToken);
    expect(a.tokenDigest).toHaveLength(64);
    expect(a.tokenDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(a.rawToken).not.toBe(a.tokenDigest);
    expect(hashInvitationToken(a.rawToken)).toBe(a.tokenDigest);
  });

  it("digest is stable for the same raw token", () => {
    const { rawToken, tokenDigest } = generateInvitationToken();
    expect(hashInvitationToken(rawToken)).toBe(tokenDigest);
    expect(hashInvitationToken(rawToken)).toBe(hashInvitationToken(rawToken));
  });

  it("validates token shape and rejects oversized tokens", () => {
    const { rawToken } = generateInvitationToken();
    expect(isValidInvitationRawToken(rawToken)).toBe(true);
    expect(isValidInvitationRawToken("")).toBe(false);
    expect(isValidInvitationRawToken("a".repeat(300))).toBe(false);
    expect(isValidInvitationRawToken("not valid!")).toBe(false);
  });

  it("normalizes email and masks safely", () => {
    expect(normalizeInvitationEmail("  Admin@Example.COM ")).toBe(
      "admin@example.com"
    );
    expect(normalizeInvitationEmail("bad")).toBeNull();
    expect(maskEmail("admin@example.com")).toBe("ad***@example.com");
  });

  it("accept path contains raw token only", () => {
    const { rawToken, tokenDigest } = generateInvitationToken();
    const path = invitationAcceptPath(rawToken);
    expect(path).toContain(encodeURIComponent(rawToken));
    expect(path).toContain("/admin/invitations/start");
    expect(path).not.toContain(tokenDigest);
  });

  it("preserves safe invitation next URL", () => {
    const next = `/admin/invitations/accept`;
    expect(safeInternalPath(next, "/account")).toBe(next);
    expect(safeInternalPath("https://evil.com", "/account")).toBe("/account");
  });
});

describe("owner safety", () => {
  const members = [
    { userId: "o1", role: "owner" as const, status: "active" },
    { userId: "op1", role: "operations" as const, status: "active" },
  ];

  it("blocks demoting final owner", () => {
    const onlyOwner = [{ userId: "o1", role: "owner" as const, status: "active" }];
    expect(
      canChangeMemberRole({
        members: onlyOwner,
        targetUserId: "o1",
        newRole: "support",
      }).ok
    ).toBe(false);
  });

  it("blocks suspending/revoking final owner", () => {
    const onlyOwner = [{ userId: "o1", role: "owner" as const, status: "active" }];
    expect(
      canSuspendOrRevokeMember({ members: onlyOwner, targetUserId: "o1" }).ok
    ).toBe(false);
  });

  it("allows owner change when another active owner exists", () => {
    const twoOwners = [
      ...members,
      { userId: "o2", role: "owner" as const, status: "active" },
    ];
    expect(countActiveOwners(twoOwners)).toBe(2);
    expect(
      canChangeMemberRole({
        members: twoOwners,
        targetUserId: "o1",
        newRole: "operations",
      })
    ).toEqual({ ok: true });
    expect(
      canSuspendOrRevokeMember({ members: twoOwners, targetUserId: "o1" })
    ).toEqual({ ok: true });
  });
});

describe("audit sanitization", () => {
  it("strips secrets from details", () => {
    const clean = sanitizeAuditDetails({
      email: "ad***@example.com",
      rawToken: "SHOULD_NOT_APPEAR",
      token_digest: "abc",
      password: "x",
      role: "operations",
    });
    expect(clean).toEqual({
      email: "ad***@example.com",
      role: "operations",
    });
  });
});

describe("legacy profile admin flag", () => {
  it("permission checks ignore profiles.role entirely", () => {
    // Application auth uses membership status/role only.
    expect(
      hasAdminPermission({ role: "owner", status: "revoked" }, "admin.access")
    ).toBe(false);
    // A hypothetical profiles.role=admin without membership is represented as null.
    expect(hasAdminPermission(null, "admin.access")).toBe(false);
  });
});
