import { escapeEmailHtml } from "./productEmail";

export const PADEL_PATHWAYS_SENDER = "Padel Pathways <hello@padelpathways.com>";
export const PADEL_PATHWAYS_REPLY_TO = "hello@padelpathways.com";

export type BrandedEmailDetail = {
  label: string;
  value: string;
};

/** Body paragraphs and detail values are plain text. Only this template supplies markup. */
export function brandedEmailTemplate(input: {
  title: string;
  paragraphs: string[];
  note?: string | null;
  noteLabel?: string | null;
  details?: BrandedEmailDetail[] | null;
  actionLabel?: string | null;
  actionUrl?: string | null;
  origin: string;
  eyebrow?: string;
}) {
  const escape = escapeEmailHtml;
  const origin = input.origin.replace(/\/$/, "");
  const logo = `${origin}/brand/padelpathways-logo-email.png`;
  const preheader = input.paragraphs[0]?.trim() || input.title;
  const details = (input.details ?? []).filter((row) => row.value.trim());
  const actionLabel = input.actionLabel?.trim() ?? "";
  const actionUrl = input.actionUrl?.trim() ?? "";
  const note = input.note?.trim() ?? "";

  const detailRows = details.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;border-collapse:collapse">${details
        .map(
          (row) =>
            `<tr><td style="padding:8px 16px 8px 0;font-size:13px;line-height:1.4;color:#566675;vertical-align:top;width:120px">${escape(row.label)}</td><td style="padding:8px 0;font-size:15px;line-height:1.5;color:#031322;white-space:pre-line">${escape(row.value)}</td></tr>`
        )
        .join("")}</table>`
    : "";

  const action =
    actionLabel && actionUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0"><tr><td style="background:#031322;border-radius:10px"><a href="${escape(actionUrl)}" style="display:inline-block;padding:16px 24px;font-size:14px;font-weight:bold;color:#d2eb26;text-decoration:none">${escape(actionLabel)} &rarr;</a></td></tr></table>`
      : "";

  const noteBlock = note
    ? `<div style="margin:24px 0;padding:20px;background:#f4f4f5;border-left:4px solid #d2eb26"><strong style="font-size:14px">${escape(input.noteLabel?.trim() || "A note from our team")}</strong><p style="margin:8px 0 0;font-size:15px;line-height:1.6;white-space:pre-line">${escape(note)}</p></div>`
    : "";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(input.title)}</title></head><body style="margin:0;background:#f4f4f5;color:#031322;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${escape(preheader)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#fff;border-radius:20px;overflow:hidden"><tr><td style="background:#031322;padding:28px 32px"><a href="${escape(origin)}"><img src="${escape(logo)}" alt="PADEL PATHWAYS" width="190" style="display:block;width:190px;max-width:100%;height:auto;color:#d2eb26;font-size:20px;font-weight:bold"></a></td></tr><tr><td style="height:5px;background:#d2eb26"></td></tr><tr><td style="padding:36px 32px"><p style="margin:0 0 16px;font-size:11px;letter-spacing:2px;color:#566675">${escape(input.eyebrow?.trim() || "YOUR NEXT STEP ON COURT")}</p><h1 style="margin:0 0 24px;font-size:28px;line-height:1.2;font-weight:800">${escape(input.title)}</h1>${input.paragraphs.map((paragraph) => `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#405365">${escape(paragraph)}</p>`).join("")}${detailRows}${noteBlock}${action}<p style="margin:28px 0 0;font-size:14px;line-height:1.6;color:#566675">Need a hand? Reply to this email or contact <a style="color:#031322" href="mailto:hello@padelpathways.com">hello@padelpathways.com</a>.</p></td></tr><tr><td style="padding:24px 32px;background:#edf1f2;font-size:12px;line-height:1.6;color:#566675"><strong style="color:#031322">PADEL PATHWAYS</strong><br>Own your path.</td></tr></table></td></tr></table></body></html>`;
}

function parseCopyList(raw: string, to: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[,;]/)
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    ),
  ].filter((email) => email !== to.trim().toLowerCase());
}

/**
 * Test BCC list.
 * `EMAIL_TEST_COPY_EMAILS` is the canonical list. An empty value sends no copies.
 * Application emails may still fall back to `REGISTRATION_TEST_COPY_EMAILS` when the
 * generic variable is unset, so existing deployments keep their current copies.
 */
export function emailTestCopies(
  to: string,
  options?: { includeLegacyRegistration?: boolean }
): string[] {
  if (process.env.EMAIL_TEST_COPY_EMAILS !== undefined) {
    return parseCopyList(process.env.EMAIL_TEST_COPY_EMAILS, to);
  }
  if (options?.includeLegacyRegistration) {
    return parseCopyList(process.env.REGISTRATION_TEST_COPY_EMAILS ?? "", to);
  }
  return [];
}

/** @deprecated Use brandedEmailTemplate. */
export const registrationTemplate = brandedEmailTemplate;

/** @deprecated Use PADEL_PATHWAYS_SENDER. */
export const REGISTRATION_SENDER = PADEL_PATHWAYS_SENDER;

/** @deprecated Use emailTestCopies. Application callers keep the legacy fallback. */
export function registrationCopies(to: string): string[] {
  return emailTestCopies(to, { includeLegacyRegistration: true });
}
