export async function sendProductEmail(input: {
  to: string;
  subject: string;
  html: string;
  logLabel?: string;
}): Promise<void> {
  const label = input.logLabel ?? "product-email";
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.ENQUIRY_FROM_EMAIL?.trim();
  if (!apiKey || !from || !input.to.trim()) {
    console.warn(`[${label}] skipped: missing Resend configuration or recipient`);
    return;
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
      console.warn(`[${label}] send failed:`, result.error.message);
    }
  } catch (error) {
    console.warn(
      `[${label}] send failed:`,
      error instanceof Error ? error.message : error
    );
  }
}

export function escapeEmailHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
