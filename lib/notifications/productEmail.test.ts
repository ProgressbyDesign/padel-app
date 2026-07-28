import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { maskEmail } from "@/lib/admin/invitationToken";

const sendMock = vi.fn();

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

describe("sendEmailWithResult", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    sendMock.mockReset();
    process.env = {
      ...originalEnv,
      RESEND_API_KEY: "test-key",
      RESEND_FROM_EMAIL: "Padel Pathways <admin@example.com>",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it("requires data.id before reporting success", async () => {
    sendMock.mockResolvedValue({ data: {}, error: null });
    const { sendEmailWithResult } = await import(
      "@/lib/notifications/productEmail"
    );
    const result = await sendEmailWithResult({
      to: "owner@example.com",
      subject: "Test",
      html: "<p>Test</p>",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("provider_missing_message_id");
    }
  });

  it("returns provider id on successful send", async () => {
    sendMock.mockResolvedValue({ data: { id: "msg_123" }, error: null });
    const { sendEmailWithResult } = await import(
      "@/lib/notifications/productEmail"
    );
    const result = await sendEmailWithResult({
      to: "owner@example.com",
      subject: "Test",
      html: "<p>Test</p>",
    });
    expect(result).toEqual({ ok: true, providerId: "msg_123" });
  });
});

describe("logInvitationEmailAttempt", () => {
  it("logs only safe invitation metadata", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { logInvitationEmailAttempt } = await import(
      "@/lib/notifications/invitationEmailLog"
    );

    logInvitationEmailAttempt({
      invitationId: "inv-1",
      recipient: "admin@example.com",
      senderAddress: "Padel Pathways <admin@padelpathways.com>",
      outcome: "sent",
      providerMessageId: "msg_123",
    });

    const logged = JSON.stringify(info.mock.calls[0]?.[1]);
    expect(logged).toContain("inv-1");
    expect(logged).toContain(maskEmail("admin@example.com"));
    expect(logged).toContain("padelpathways.com");
    expect(logged).toContain("msg_123");
    expect(logged).not.toContain("admin@example.com");
    expect(logged).not.toContain("re_");
    info.mockRestore();
  });
});
