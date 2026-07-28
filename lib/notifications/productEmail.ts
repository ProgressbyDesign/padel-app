import {
  mapEmailProviderError,
  type EmailDeliveryResult,
} from "@/lib/notifications/emailDelivery";
import { configuredSenderAddress } from "@/lib/notifications/emailServiceDiagnostic";

export async function sendEmailWithResult(input: {
  to: string;
  subject: string;
  html: string;
  logLabel?: string;
}): Promise<EmailDeliveryResult> {
  const label = input.logLabel ?? "product-email";
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = configuredSenderAddress();

  if (!apiKey) {
    const mapped = mapEmailProviderError({ missingApiKey: true });
    if (process.env.NODE_ENV === "development") {
      console.warn(`[${label}] ${mapped.errorCode}: RESEND_API_KEY missing`);
    }
    return { ok: false, ...mapped };
  }
  if (!from) {
    const mapped = mapEmailProviderError({ missingFrom: true });
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[${label}] ${mapped.errorCode}: RESEND_FROM_EMAIL / ENQUIRY_FROM_EMAIL missing`
      );
    }
    return { ok: false, ...mapped };
  }
  if (!input.to.trim()) {
    const mapped = mapEmailProviderError({ missingRecipient: true });
    return { ok: false, ...mapped };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to: input.to.trim(),
      subject: input.subject,
      html: input.html,
    });

    if (error) {
      const mapped = mapEmailProviderError({
        providerMessage: error.message,
        providerName: error.name,
      });
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `[${label}] provider error:`,
          error.name,
          error.message
        );
      } else {
        console.warn(`[${label}] send failed:`, mapped.errorCode);
      }
      return { ok: false, ...mapped };
    }

    const providerId =
      data && typeof data.id === "string" && data.id.trim()
        ? data.id.trim()
        : null;
    if (!providerId) {
      const mapped = mapEmailProviderError({
        providerMessage: "missing message id",
      });
      if (process.env.NODE_ENV === "development") {
        console.warn(`[${label}] ${mapped.errorCode}: Resend returned no data.id`);
      } else {
        console.warn(`[${label}] send failed:`, mapped.errorCode);
      }
      return { ok: false, ...mapped };
    }

    return { ok: true, providerId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    const mapped = mapEmailProviderError({ providerMessage: message });
    if (process.env.NODE_ENV === "development") {
      console.warn(`[${label}] exception:`, message);
    } else {
      console.warn(`[${label}] send failed:`, mapped.errorCode);
    }
    return { ok: false, ...mapped };
  }
}

/** Fire-and-forget wrapper for existing callers. */
export async function sendProductEmail(input: {
  to: string;
  subject: string;
  html: string;
  logLabel?: string;
}): Promise<void> {
  await sendEmailWithResult(input);
}

export function escapeEmailHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
