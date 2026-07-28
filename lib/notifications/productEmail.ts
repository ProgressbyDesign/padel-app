import {
  mapEmailProviderError,
  type EmailDeliveryResult,
} from "@/lib/notifications/emailDelivery";

export async function sendEmailWithResult(input: {
  to: string;
  subject: string;
  html: string;
  logLabel?: string;
}): Promise<EmailDeliveryResult> {
  const label = input.logLabel ?? "product-email";
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.ENQUIRY_FROM_EMAIL?.trim();

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
    const result = await resend.emails.send({
      from,
      to: input.to.trim(),
      subject: input.subject,
      html: input.html,
    });

    if (result.error) {
      const mapped = mapEmailProviderError({
        providerMessage: result.error.message,
        providerName: result.error.name,
      });
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `[${label}] provider error:`,
          result.error.name,
          result.error.message
        );
      } else {
        console.warn(`[${label}] send failed:`, mapped.errorCode);
      }
      return { ok: false, ...mapped };
    }

    const providerId =
      result.data && typeof result.data.id === "string" ? result.data.id : null;
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
