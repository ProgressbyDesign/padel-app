import { describe, expect, it } from "vitest";
import {
  generateInvitationToken,
  hashInvitationToken,
} from "@/lib/admin/invitationToken";
import {
  buildInvitationDeliveryFailureUpdate,
  buildInvitationDeliverySuccessUpdate,
  buildInvitationResendTokenUpdate,
  mapEmailProviderError,
} from "@/lib/notifications/emailDelivery";

describe("invitation email delivery payloads", () => {
  it("maps missing configuration to safe failure", () => {
    expect(mapEmailProviderError({ missingApiKey: true }).errorCode).toBe(
      "config_missing_api_key"
    );
    expect(mapEmailProviderError({ missingFrom: true }).errorCode).toBe(
      "config_missing_sender"
    );
    expect(mapEmailProviderError({ missingFrom: true }).message).toMatch(
      /not configured correctly/i
    );
  });

  it("builds sent delivery payload from provider success", () => {
    const update = buildInvitationDeliverySuccessUpdate({
      providerId: "msg_123",
      atIso: "2026-07-28T10:00:00.000Z",
    });
    expect(update).toEqual({
      last_email_status: "sent",
      last_send_attempt_at: "2026-07-28T10:00:00.000Z",
      last_email_provider_id: "msg_123",
      last_email_error_code: null,
    });
  });

  it("builds failed delivery payload from provider failure", () => {
    const mapped = mapEmailProviderError({
      providerMessage: "domain is not verified",
    });
    const update = buildInvitationDeliveryFailureUpdate({
      errorCode: mapped.errorCode,
      atIso: "2026-07-28T10:00:00.000Z",
    });
    expect(update.last_email_status).toBe("failed");
    expect(update.last_email_provider_id).toBeNull();
    expect(update.last_email_error_code).toBe("sender_domain_unverified");
  });

  it("resend rotates digest and expiry on same pending row", () => {
    const first = generateInvitationToken();
    const second = generateInvitationToken();
    expect(first.tokenDigest).not.toBe(second.tokenDigest);
    expect(hashInvitationToken(first.rawToken)).not.toBe(second.tokenDigest);

    const patch = buildInvitationResendTokenUpdate({
      tokenDigest: second.tokenDigest,
      expiresAt: "2026-08-04T10:00:00.000Z",
    });
    expect(patch.status).toBe("pending");
    expect(patch.token_digest).toBe(second.tokenDigest);
    expect(patch.expires_at).toBe("2026-08-04T10:00:00.000Z");
    // Old raw token no longer matches new digest
    expect(hashInvitationToken(first.rawToken)).not.toBe(patch.token_digest);
  });

  it("omits raw token and digest from audit-like detail builders", () => {
    const first = generateInvitationToken();
    const details = {
      email: "ad***@example.com",
      role: "support",
      emailResult: "sent" as const,
    };
    expect(JSON.stringify(details)).not.toContain(first.rawToken);
    expect(JSON.stringify(details)).not.toContain(first.tokenDigest);
  });
});
