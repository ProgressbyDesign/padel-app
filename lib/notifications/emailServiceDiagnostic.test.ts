import { describe, expect, it } from "vitest";
import {
  buildEmailServiceDiagnostic,
  senderDomainFromAddress,
} from "@/lib/notifications/emailServiceDiagnostic";
import { mapEmailProviderError } from "@/lib/notifications/emailDelivery";

describe("email service diagnostic", () => {
  it("extracts sender domain from display-name addresses", () => {
    expect(senderDomainFromAddress("Padel Pathways <admin@example.com>")).toBe(
      "example.com"
    );
    expect(senderDomainFromAddress("admin@example.com")).toBe("example.com");
  });

  it("builds diagnostic flags without exposing secrets", () => {
    const diagnostic = buildEmailServiceDiagnostic({
      lastEmailStatus: "failed",
      lastEmailErrorCode: "config_missing_sender",
      lastSendAttemptAt: "2026-07-28T10:00:00.000Z",
    });

    expect(diagnostic.lastInvitationEmailResult).toBe("Email failed");
    expect(diagnostic.lastSafeProviderErrorCode).toBe("config_missing_sender");
    expect(JSON.stringify(diagnostic)).not.toMatch(/re_[A-Za-z0-9]+/);
  });

  it("keeps invitation failures specific and other failures generic", () => {
    expect(
      mapEmailProviderError({
        providerMessage: "missing message id",
        context: "invitation",
      }).message
    ).toBe("Invitation created, but the email could not be sent.");
    expect(
      mapEmailProviderError({ providerMessage: "missing message id" }).message
    ).toBe("The email could not be sent.");
  });
});
