import type { EnquirySubmitPayload } from "./enquiryPayload";

/** Team notification email: form payload plus resolved coach/venue context from `submitEnquiry`. */
export type TeamEnquiryEmailInput = EnquirySubmitPayload & {
  subject_name: string | null;
  subject_type: "coach" | "venue" | null;
  subject_location: string | null;
  source_url: string | null;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safe(s: string | null | undefined): string {
  return escapeHtml((s ?? "").trim() || "—");
}

function pageLinkHtml(url: string | null | undefined): string {
  const u = (url ?? "").trim();
  if (!u) return "—";
  if (!/^https?:\/\//i.test(u)) return safe(u);
  return `<a href="${escapeHtml(u)}">${escapeHtml(u)}</a>`;
}

/** Build HTML for internal team notification (never trust raw HTML from user input). */
export function buildTeamEnquiryEmailHtml(payload: TeamEnquiryEmailInput): string {
  const goals = payload.main_goals.map((g) => safe(g)).join(", ") || "—";
  const dest = payload.preferred_destinations.map((d) => safe(d)).join(", ") || "—";

  const target = payload.subject_name?.trim()
    ? `${payload.subject_type === "coach" ? "Coach" : "Venue"}: ${safe(payload.subject_name)}`
    : payload.coachId
      ? `Coach: ${safe(payload.coachId)}`
      : `Venue: ${safe(payload.venueId)}`;

  return `
    <h2>New enquiry</h2>
    <p><strong>Target:</strong> ${target}</p>
    <p><strong>Location:</strong> ${safe(payload.subject_location)}</p>
    <p><strong>Page:</strong> ${pageLinkHtml(payload.source_url)}</p>
    <p><strong>Name:</strong> ${safe(payload.full_name)}</p>
    <p><strong>Email:</strong> ${safe(payload.email)}</p>
    <p><strong>Phone:</strong> ${safe(payload.phone)}</p>
    <p><strong>Age:</strong> ${payload.age != null ? escapeHtml(String(payload.age)) : "—"}</p>
    <p><strong>Nationality:</strong> ${safe(payload.nationality)}</p>
    <p><strong>Enquirer location:</strong> ${safe([payload.current_location_city, payload.current_location_country].filter(Boolean).join(", "))}</p>
    <p><strong>Level:</strong> ${safe(payload.playing_level)}</p>
    <p><strong>Playing duration:</strong> ${safe(payload.playing_duration)}</p>
    <p><strong>Goals:</strong> ${goals}</p>
    <p><strong>Goals detail:</strong> ${safe(payload.goals_detail)}</p>
    <p><strong>Destinations:</strong> ${dest}</p>
    <p><strong>Training duration:</strong> ${safe(payload.preferred_duration)}</p>
    <p><strong>Start date:</strong> ${safe(payload.preferred_start_date)}</p>
    <p><strong>Training type:</strong> ${safe(payload.training_type)}</p>
    <p><strong>Budget:</strong> ${safe(payload.budget_range)}</p>
    <p><strong>Accommodation:</strong> ${safe(payload.accommodation)}</p>
    <p><strong>Trained abroad:</strong> ${safe(payload.trained_abroad)}</p>
    <p><strong>Injuries:</strong> ${safe(payload.injuries)}</p>
    <p><strong>Other:</strong> ${safe(payload.anything_else)}</p>
    <p><strong>Personalised recommendation:</strong> ${payload.wants_personalised_recommendation ? "Yes" : "No"}</p>
  `;
}

export function buildUserConfirmationEmailHtml(payload: EnquirySubmitPayload): string {
  const first = (payload.full_name ?? "").trim().split(/\s+/)[0] || "there";
  const name = escapeHtml(first);
  return `
    <p>Hi ${name},</p>
    <p>Thanks — we&apos;ve received your enquiry.</p>
    <p>We&apos;ll get back to you shortly.</p>
    <p style="margin-top:1.5rem;color:#555;font-size:14px;">— Padel Pathways</p>
  `;
}
