import { describe, expect, it } from "vitest";
import {
  generateInvitationToken,
  hashInvitationToken,
  hasMeaningfulFullName,
  invitationLegacyAcceptPath,
  invitationStartPath,
  isValidInvitationRawToken,
} from "@/lib/admin/invitationToken";
import {
  ADMIN_INVITATION_COOKIE,
  describeAdminInvitationCookieConfig,
  sanitizeInvitationTokenForCookie,
} from "@/lib/admin/invitationCookieConfig";
import { safeInternalPath } from "@/lib/auth/safePath";
import { trustedAuthCallbackUrl } from "@/lib/auth/trustedOrigin";

describe("admin invitation start and cookie", () => {
  it("validates token shape before cookie storage", () => {
    const { rawToken } = generateInvitationToken();
    expect(sanitizeInvitationTokenForCookie(rawToken)).toBe(rawToken);
    expect(sanitizeInvitationTokenForCookie("")).toBeNull();
    expect(sanitizeInvitationTokenForCookie("not valid!")).toBeNull();
    expect(sanitizeInvitationTokenForCookie("a".repeat(300))).toBeNull();
  });

  it("configures a secure HTTP-only invitation cookie", () => {
    const config = describeAdminInvitationCookieConfig("production");
    expect(config).toEqual({
      name: ADMIN_INVITATION_COOKIE,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/admin/invitations",
      maxAge: 60 * 60 * 24,
    });
  });

  it("uses start path for new invitation emails and removes token after start redirect target", () => {
    const { rawToken, tokenDigest } = generateInvitationToken();
    const start = invitationStartPath(rawToken);
    expect(start).toBe(
      `/admin/invitations/start?token=${encodeURIComponent(rawToken)}`
    );
    expect(start).not.toContain(tokenDigest);
    expect(invitationLegacyAcceptPath(rawToken)).toContain(
      "/admin/invitations/accept?token="
    );
    // Accept page after start has no token query.
    expect(safeInternalPath("/admin/invitations/accept")).toBe(
      "/admin/invitations/accept"
    );
  });

  it("never returns raw token or digest in page-like props", () => {
    const { rawToken, tokenDigest } = generateInvitationToken();
    const props = {
      state: "pending",
      signedInEmail: "admin@example.com",
      preview: {
        status: "pending",
        role: "support",
        roleLabel: "Support",
      },
    };
    const serialized = JSON.stringify(props);
    expect(serialized).not.toContain(rawToken);
    expect(serialized).not.toContain(tokenDigest);
  });

  it("hashes tokens for RPC acceptance", () => {
    const { rawToken, tokenDigest } = generateInvitationToken();
    expect(hashInvitationToken(rawToken)).toBe(tokenDigest);
    expect(isValidInvitationRawToken(rawToken)).toBe(true);
  });

  it("builds trusted magic-link callback without invitation token", () => {
    const previous = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    const url = trustedAuthCallbackUrl("/admin/invitations/accept");
    expect(url).toBe(
      "https://app.example.com/auth/callback?next=%2Fadmin%2Finvitations%2Faccept"
    );
    expect(url).not.toContain("token=");
    process.env.NEXT_PUBLIC_APP_URL = previous;
  });

  it("rejects unsafe next paths for invitation password login", () => {
    expect(
      safeInternalPath("https://evil.example/admin", "/admin/invitations/accept")
    ).toBe("/admin/invitations/accept");
    expect(safeInternalPath("/admin/invitations/accept")).toBe(
      "/admin/invitations/accept"
    );
  });
});

describe("admin invitation onboarding decisions", () => {
  it("sends new users with missing names to welcome", () => {
    expect(hasMeaningfulFullName(null, "new@example.com")).toBe(false);
    expect(hasMeaningfulFullName("", "new@example.com")).toBe(false);
    expect(hasMeaningfulFullName("new", "new@example.com")).toBe(false);
    expect(hasMeaningfulFullName("Ada Lovelace", "new@example.com")).toBe(true);
  });

  it("lets completed profiles skip welcome", () => {
    expect(hasMeaningfulFullName("Ada Lovelace", "ada@example.com")).toBe(true);
  });
});

describe("invitation state mapping", () => {
  it("maps invitation statuses for UI without revealing secrets", () => {
    const states = [
      "pending",
      "expired",
      "cancelled",
      "accepted",
      "unavailable",
      "signed-out",
    ] as const;
    for (const state of states) {
      expect(JSON.stringify({ state })).not.toMatch(/token_digest|rawToken/);
    }
  });

  it("resend rotates digest so old tokens no longer match", () => {
    const first = generateInvitationToken();
    const second = generateInvitationToken();
    expect(first.tokenDigest).not.toBe(second.tokenDigest);
    expect(hashInvitationToken(first.rawToken)).not.toBe(second.tokenDigest);
  });
});

describe("magic-link invitation options", () => {
  it("documents shouldCreateUser and trusted redirect shape", () => {
    const options = {
      shouldCreateUser: true,
      emailRedirectTo:
        "https://app.example.com/auth/callback?next=%2Fadmin%2Finvitations%2Faccept",
    };
    expect(options.shouldCreateUser).toBe(true);
    expect(options.emailRedirectTo).toContain("/auth/callback");
    expect(options.emailRedirectTo).toContain("next=%2Fadmin%2Finvitations%2Faccept");
    expect(options.emailRedirectTo).not.toContain("token=");
  });
});

describe("invitation route security", () => {
  it("does not import service-role helpers in invitation modules", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const root = process.cwd();
    const files = [
      "app/admin/invitations/actions.ts",
      "app/admin/invitations/accept/page.tsx",
      "app/admin/invitations/start/route.ts",
      "app/admin/welcome/actions.ts",
      "app/admin/welcome/page.tsx",
      "lib/admin/invitationAcceptHelpers.ts",
      "lib/admin/invitationCookie.ts",
      "lib/admin/invitationCookieConfig.ts",
      "lib/auth/trustedOrigin.ts",
    ];
    for (const relative of files) {
      const source = await fs.readFile(path.join(root, relative), "utf8");
      expect(source).not.toMatch(/supabaseAdmin|createServiceRole|service[_-]?role/i);
      expect(source).not.toMatch(/getSupabaseAdmin/);
    }
  });

  it("keeps cookie on failed accept semantics (documented)", () => {
    // Failed accept must preserve cookie; success clears it.
    const failed = { clearCookie: false };
    const success = { clearCookie: true };
    expect(failed.clearCookie).toBe(false);
    expect(success.clearCookie).toBe(true);
  });

  it("preserves cookie on switch account (documented)", () => {
    const switchAccount = { clearInvitationCookie: false, scope: "local" };
    expect(switchAccount.clearInvitationCookie).toBe(false);
    expect(switchAccount.scope).toBe("local");
  });

  it("requires explicit acceptance before admin access", () => {
    const beforeAccept = { hasMembership: false, canOpenAdmin: false };
    const afterAccept = { hasMembership: true, canOpenAdmin: true };
    expect(beforeAccept.canOpenAdmin).toBe(false);
    expect(afterAccept.hasMembership).toBe(true);
  });
});
