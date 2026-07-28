export type EmailDeliverySuccess = {
  ok: true;
  providerId: string | null;
};

export type EmailDeliveryFailure = {
  ok: false;
  errorCode: string;
  message: string;
};

export type EmailDeliveryResult = EmailDeliverySuccess | EmailDeliveryFailure;

export type InvitationEmailStatus = "pending" | "sent" | "failed";

/** Map provider/config failures to short safe codes (never secrets). */
export function mapEmailProviderError(input: {
  missingApiKey?: boolean;
  missingFrom?: boolean;
  missingRecipient?: boolean;
  providerMessage?: string | null;
  providerName?: string | null;
  httpStatus?: number | null;
}): { errorCode: string; message: string } {
  if (input.missingApiKey) {
    return {
      errorCode: "config_missing_api_key",
      message:
        "Email could not be sent because the mail service is not configured correctly.",
    };
  }
  if (input.missingFrom) {
    return {
      errorCode: "config_missing_sender",
      message:
        "Email could not be sent because the mail service is not configured correctly.",
    };
  }
  if (input.missingRecipient) {
    return {
      errorCode: "invalid_recipient",
      message: "Email could not be sent because the recipient address is invalid.",
    };
  }

  const raw = `${input.providerName ?? ""} ${input.providerMessage ?? ""}`.toLowerCase();
  if (
    raw.includes("domain") &&
    (raw.includes("not verified") || raw.includes("unverified"))
  ) {
    return {
      errorCode: "sender_domain_unverified",
      message:
        "Email could not be sent because the sender domain is not verified.",
    };
  }
  if (raw.includes("invalid") && (raw.includes("from") || raw.includes("sender"))) {
    return {
      errorCode: "invalid_sender",
      message: "Email could not be sent because the sender address is invalid.",
    };
  }
  if (
    raw.includes("invalid api") ||
    raw.includes("unauthorized") ||
    raw.includes("api key") ||
    input.httpStatus === 401 ||
    input.httpStatus === 403
  ) {
    return {
      errorCode: "invalid_api_key",
      message:
        "Email could not be sent because the mail service is not configured correctly.",
    };
  }
  if (raw.includes("rate") || input.httpStatus === 429) {
    return {
      errorCode: "rate_limited",
      message: "Email could not be sent because the mail service rate limit was hit.",
    };
  }
  if (
    raw.includes("bounce") ||
    raw.includes("rejected") ||
    raw.includes("invalid recipient") ||
    raw.includes("not a valid")
  ) {
    return {
      errorCode: "recipient_rejected",
      message: "Email could not be sent because the recipient was rejected.",
    };
  }
  if (input.httpStatus && input.httpStatus >= 500) {
    return {
      errorCode: "provider_unavailable",
      message: "Email could not be sent because the mail service is unavailable.",
    };
  }
  if (input.providerMessage?.toLowerCase().includes("missing message id")) {
    return {
      errorCode: "provider_missing_message_id",
      message: "Invitation created, but the email could not be sent.",
    };
  }
  return {
    errorCode: "delivery_failed",
    message: "Invitation created, but the email could not be sent.",
  };
}

export function buildInvitationDeliverySuccessUpdate(input: {
  providerId: string | null;
  atIso?: string;
}): {
  last_email_status: "sent";
  last_send_attempt_at: string;
  last_email_provider_id: string | null;
  last_email_error_code: null;
} {
  return {
    last_email_status: "sent",
    last_send_attempt_at: input.atIso ?? new Date().toISOString(),
    last_email_provider_id: input.providerId,
    last_email_error_code: null,
  };
}

export function buildInvitationDeliveryFailureUpdate(input: {
  errorCode: string;
  atIso?: string;
}): {
  last_email_status: "failed";
  last_send_attempt_at: string;
  last_email_provider_id: null;
  last_email_error_code: string;
} {
  return {
    last_email_status: "failed",
    last_send_attempt_at: input.atIso ?? new Date().toISOString(),
    last_email_provider_id: null,
    last_email_error_code: input.errorCode.slice(0, 80),
  };
}

export function buildInvitationResendRowUpdate(input: {
  tokenDigest: string;
  expiresAt: string;
}): {
  token_digest: string;
  expires_at: string;
  status: "pending";
} {
  return {
    token_digest: input.tokenDigest,
    expires_at: input.expiresAt,
    status: "pending",
  };
}

/** Alias used by team actions. */
export const buildInvitationResendTokenUpdate = buildInvitationResendRowUpdate;

export function invitationEmailStatusLabel(
  status: InvitationEmailStatus | null | undefined
): string {
  switch (status) {
    case "sent":
      return "Email sent";
    case "failed":
      return "Email failed";
    case "pending":
      return "Never sent";
    default:
      return "Never sent";
  }
}

export function configuredAppOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "";
  return raw.replace(/\/$/, "");
}

export function absoluteAppUrl(path: string): string {
  const origin = configuredAppOrigin();
  if (!origin) return path;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}
