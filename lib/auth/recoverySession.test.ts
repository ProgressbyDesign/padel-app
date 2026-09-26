import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  RECOVERY_COOKIE,
  isRecoveryAmr,
  passwordRecoveryDestination,
  recoveryCookieOptions,
} from "./recoverySession";

const ROOT = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(ROOT, relativePath), "utf8").replace(/\r\n/g, "\n");
}

describe("isRecoveryAmr", () => {
  it("accepts GoTrue recovery method objects and strings", () => {
    expect(isRecoveryAmr([{ method: "recovery", timestamp: 1 }])).toBe(true);
    expect(isRecoveryAmr(["recovery"])).toBe(true);
    expect(isRecoveryAmr([{ method: "password" }])).toBe(false);
    expect(isRecoveryAmr(undefined)).toBe(false);
  });
});

describe("passwordRecoveryDestination", () => {
  it("keeps next=/reset-password and recovers when next was stripped", () => {
    expect(
      passwordRecoveryDestination({ nextPath: "/reset-password", amr: [] })
    ).toBe("/reset-password");
    expect(
      passwordRecoveryDestination({
        nextPath: "/account",
        amr: [{ method: "recovery" }],
      })
    ).toBe("/reset-password");
  });

  it("does not send ordinary sign-in sessions to the reset form", () => {
    expect(
      passwordRecoveryDestination({
        nextPath: "/account",
        amr: [{ method: "password" }],
      })
    ).toBe("/account");
  });
});

describe("recovery cookie", () => {
  it("is httpOnly, lax, root-path, and secure in production", () => {
    expect(RECOVERY_COOKIE).toBe("pp_password_recovery");
    expect(recoveryCookieOptions("production")).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 20,
    });
    expect(recoveryCookieOptions("development").secure).toBe(false);
  });
});

describe("password recovery wiring", () => {
  it("requests reset emails through the PKCE callback with next=/reset-password", () => {
    const actions = read("app/actions/auth.ts");
    expect(actions).toContain('authCallbackUrl("/reset-password")');
    expect(actions).toContain("resetPasswordForEmail");
    expect(actions).toContain("hasPasswordRecoverySession");
    expect(actions).not.toContain("hasPasswordRecoveryAccess");
    expect(actions).toContain("clearPasswordRecoverySession");
    expect(actions).not.toContain("service_role");
  });

  it("persists session and recovery cookies on the callback redirect", () => {
    const callback = read("app/auth/callback/route.ts");
    expect(callback).toContain("exchangeCodeForSession(code)");
    expect(callback).toContain("response.cookies.set");
    expect(callback).toContain("applyPasswordRecoveryCookie");
    expect(callback).toContain("passwordRecoveryDestination");
    expect(callback).toContain('safeInternalPath(requestUrl.searchParams.get("next"))');
  });

  it("forwards Site URL leftover codes only and guards the reset page with the marker cookie", () => {
    const proxy = read("proxy.ts");
    expect(proxy).toContain("strandedAuthCallbackPath");
    expect(proxy).not.toContain('pathname !== "/auth/callback"');

    const page = read("app/reset-password/page.tsx");
    expect(page).toContain("hasPasswordRecoverySession");
    expect(page).not.toContain("hasPasswordRecoveryAccess");
    expect(page).toContain('redirect("/forgot-password?error=invalid")');
    expect(page).toContain("Choose a new password");

    const recovery = read("lib/auth/recovery.ts");
    expect(recovery).not.toContain("isRecoveryAmr");
    expect(recovery).not.toContain("getClaims");
  });

  it("reset email template uses ConfirmationURL, not SiteURL", () => {
    const template = read("supabase/templates/recovery.html");
    expect(template).toContain('href="{{ .ConfirmationURL }}"');
    expect(template).not.toContain('href="{{ .SiteURL }}"');
    expect(template).not.toContain("{{ .TokenHash }}");
  });
});
