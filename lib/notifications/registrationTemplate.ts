import { escapeEmailHtml } from "./productEmail";

export const REGISTRATION_SENDER = "Padel Pathways <hello@padelpathways.com>";

/** Body paragraphs are plain text. Only our own template supplies markup. */
export function registrationTemplate(input: {
  title: string;
  paragraphs: string[];
  note?: string | null;
  actionLabel: string;
  actionUrl: string;
  origin: string;
}) {
  const escape = escapeEmailHtml;
  const logo = `${input.origin.replace(/\/$/, "")}/brand/padelpathways-logo-email.png`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(input.title)}</title></head><body style="margin:0;background:#f4f4f5;color:#031322;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${escape(input.paragraphs[0] || input.title)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#fff;border-radius:20px;overflow:hidden"><tr><td style="background:#031322;padding:28px 32px"><a href="${escape(input.origin)}"><img src="${escape(logo)}" alt="PADEL PATHWAYS" width="190" style="display:block;width:190px;max-width:100%;height:auto;color:#d2eb26;font-size:20px;font-weight:bold"></a></td></tr><tr><td style="height:5px;background:#d2eb26"></td></tr><tr><td style="padding:36px 32px"><p style="margin:0 0 16px;font-size:11px;letter-spacing:2px;color:#566675">YOUR NEXT STEP ON COURT</p><h1 style="margin:0 0 24px;font-size:28px;line-height:1.2;font-weight:800">${escape(input.title)}</h1>${input.paragraphs.map(p => `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#405365">${escape(p)}</p>`).join("")}${input.note?.trim() ? `<div style="margin:24px 0;padding:20px;background:#f4f4f5;border-left:4px solid #d2eb26"><strong style="font-size:14px">A note from our team</strong><p style="margin:8px 0 0;font-size:15px;line-height:1.6;white-space:pre-line">${escape(input.note.trim())}</p></div>` : ""}<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0"><tr><td style="background:#031322;border-radius:10px"><a href="${escape(input.actionUrl)}" style="display:inline-block;padding:16px 24px;font-size:14px;font-weight:bold;color:#d2eb26;text-decoration:none">${escape(input.actionLabel)} &rarr;</a></td></tr></table><p style="margin:28px 0 0;font-size:14px;line-height:1.6;color:#566675">Need a hand? Reply to this email or contact <a style="color:#031322" href="mailto:hello@padelpathways.com">hello@padelpathways.com</a>.</p></td></tr><tr><td style="padding:24px 32px;background:#edf1f2;font-size:12px;line-height:1.6;color:#566675"><strong style="color:#031322">PADEL PATHWAYS</strong><br>Own your path.</td></tr></table></td></tr></table></body></html>`;
}

export function registrationCopies(to: string): string[] {
  // Explicitly configurable; an empty value disables test copies in production.
  const raw = process.env.REGISTRATION_TEST_COPY_EMAILS ?? "";
  return [...new Set(raw.split(/[,;]/).map(value => value.trim().toLowerCase()).filter(Boolean))]
    .filter(email => email !== to.trim().toLowerCase());
}
