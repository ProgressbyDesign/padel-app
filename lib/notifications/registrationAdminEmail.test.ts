import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  maybeSendRegistrationAdminNotification,
  registrationConfirmationEligible,
  registrationIntentLabel,
} from "@/lib/notifications/registrationAdminEmail";

const ROOT = path.resolve(__dirname, "..", "..");
const send = vi.fn();

const account = {
  name: "Juan Martin",
  email: "juan@example.com",
  intent: "Coach" as const,
  confirmedAt: "28 Sept 2026, 09:00",
};

describe("registration admin notification", () => {
  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue({ ok: true });
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.com");
    vi.stubEnv("REGISTRATION_NOTIFY_EMAIL", "notify@example.com");
    vi.stubEnv("EMAIL_TEST_COPY_EMAILS", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("recognises a new confirmation and ignores recovery, invitations, email changes and login paths", () => {
    expect(registrationConfirmationEligible({ isRecovery: false, nextPath: "/account" })).toBe(true);
    expect(registrationConfirmationEligible({ isRecovery: true, nextPath: "/account" })).toBe(false);
    expect(registrationConfirmationEligible({ isRecovery: false, nextPath: "/reset-password" })).toBe(false);
    expect(
      registrationConfirmationEligible({
        isRecovery: false,
        nextPath: "/admin/invitations/accept",
      })
    ).toBe(false);
    expect(registrationConfirmationEligible({ isRecovery: false, nextPath: "/account/settings" })).toBe(false);
    expect(registrationIntentLabel("coach")).toBe("Coach");
    expect(registrationIntentLabel("venue")).toBe("Venue");
    expect(registrationIntentLabel("player")).toBe("Player");
    expect(registrationIntentLabel(undefined)).toBe("Account");
  });

  it("sends one admin email for a newly confirmed account", async () => {
    const claim = vi.fn().mockResolvedValue(true);
    const result = await maybeSendRegistrationAdminNotification({
      isRecovery: false,
      nextPath: "/account/applications/coach",
      claim,
      loadAccount: async () => account,
      send: async (html, subject, to) => send(html, subject, to),
    });
    expect(result).toBe("sent");
    expect(claim).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    const html = send.mock.calls[0][0] as string;
    expect(send.mock.calls[0][1]).toBe("New Padel Pathways account");
    expect(send.mock.calls[0][2]).toBe("notify@example.com");
    expect(html).toContain("Juan Martin");
    expect(html).toContain("juan@example.com");
    expect(html).toContain("Coach");
    expect(html).toContain("https://example.com/admin");
    expect(html).not.toMatch(/password|token|session/i);
  });

  it("does not send again when the claim is already taken", async () => {
    const result = await maybeSendRegistrationAdminNotification({
      isRecovery: false,
      nextPath: "/account",
      claim: async () => false,
      loadAccount: async () => account,
      send: async () => send(),
    });
    expect(result).toBe("already_claimed");
    expect(send).not.toHaveBeenCalled();
  });

  it("does not claim or send for recovery, and skips when no notify address is configured", async () => {
    const claim = vi.fn();
    expect(
      await maybeSendRegistrationAdminNotification({
        isRecovery: true,
        nextPath: "/reset-password",
        claim,
        loadAccount: async () => account,
        send: async () => send(),
      })
    ).toBe("skipped");
    vi.stubEnv("REGISTRATION_NOTIFY_EMAIL", "");
    expect(
      await maybeSendRegistrationAdminNotification({
        isRecovery: false,
        nextPath: "/account",
        claim,
        loadAccount: async () => account,
        send: async () => send(),
      })
    ).toBe("unconfigured");
    expect(claim).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("retries a failed send once and then keeps the claim", async () => {
    send
      .mockResolvedValueOnce({ ok: false, errorCode: "provider_unavailable" })
      .mockResolvedValueOnce({ ok: false, errorCode: "provider_unavailable" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await maybeSendRegistrationAdminNotification({
      isRecovery: false,
      nextPath: "/account",
      claim: async () => true,
      loadAccount: async () => account,
      send: async () => send(),
    });
    expect(result).toBe("failed");
    expect(send).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(
      "[registration-email] send failed:",
      "provider_unavailable"
    );
    warn.mockRestore();
  });

  it("keeps confirmation and recovery on Supabase URLs and does not notify from login", () => {
    const confirmation = readFileSync(
      path.join(ROOT, "supabase/templates/confirmation.html"),
      "utf8"
    );
    const recovery = readFileSync(path.join(ROOT, "supabase/templates/recovery.html"), "utf8");
    const callback = readFileSync(path.join(ROOT, "app/auth/callback/route.ts"), "utf8");
    const login = readFileSync(path.join(ROOT, "app/actions/auth.ts"), "utf8");
    expect(confirmation).toContain("{{ .ConfirmationURL }}");
    expect(confirmation).toContain("Confirm my email");
    expect(confirmation).toContain("If you did not create this account");
    expect(confirmation).not.toContain("{{ .SiteURL }}");
    expect(recovery).toContain("{{ .ConfirmationURL }}");
    expect(recovery).toContain("Reset password");
    expect(callback).toContain("maybeSendRegistrationAdminNotification");
    expect(callback).toContain('destination === "/reset-password"');
    expect(login).not.toContain("maybeSendRegistrationAdminNotification");
    expect(login).not.toContain("registrationAdminEmail");
  });
});
