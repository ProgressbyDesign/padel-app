import { PAYMENT_COPY } from "@/lib/coachBookings/constants";
import type { CoachBookingRequest } from "@/lib/coachBookings/types";
import { formatInTimeZone } from "@/lib/coachAvailability/timezone";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function sessionSummary(booking: CoachBookingRequest): string {
  const when = formatInTimeZone(booking.starts_at, booking.timezone, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return `${when} (${booking.timezone})`;
}

export function buildBookingRequestCoachEmailHtml(
  booking: CoachBookingRequest
): string {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#031322">
      <h1 style="font-size:20px">New coaching session request</h1>
      <p><strong>${escapeHtml(booking.requester_name)}</strong> requested a session.</p>
      <ul>
        <li>Coach: ${escapeHtml(booking.coach?.name ?? "Coach")}</li>
        <li>Venue: ${escapeHtml(booking.venue?.name ?? "Venue")}</li>
        <li>When: ${escapeHtml(sessionSummary(booking))}</li>
        <li>Email: ${escapeHtml(booking.requester_email)}</li>
        ${
          booking.requester_phone
            ? `<li>Phone: ${escapeHtml(booking.requester_phone)}</li>`
            : ""
        }
      </ul>
      ${
        booking.message
          ? `<p><strong>Message</strong><br/>${escapeHtml(booking.message)}</p>`
          : ""
      }
      <p style="color:#5b6770">${escapeHtml(PAYMENT_COPY)}</p>
    </div>
  `;
}

export function buildBookingRequestPlayerEmailHtml(
  booking: CoachBookingRequest
): string {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#031322">
      <h1 style="font-size:20px">Request sent</h1>
      <p>Your coaching session request has been sent.</p>
      <ul>
        <li>Coach: ${escapeHtml(booking.coach?.name ?? "Coach")}</li>
        <li>Venue: ${escapeHtml(booking.venue?.name ?? "Venue")}</li>
        <li>When: ${escapeHtml(sessionSummary(booking))}</li>
      </ul>
      <p>The coach will review your request and contact you about confirmation and payment.</p>
      <p style="color:#5b6770">${escapeHtml(PAYMENT_COPY)}</p>
    </div>
  `;
}

export function buildBookingAcceptedPlayerEmailHtml(
  booking: CoachBookingRequest
): string {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#031322">
      <h1 style="font-size:20px">Your request has been accepted</h1>
      <p>Contact the coach to confirm payment and final arrangements.</p>
      <ul>
        <li>Coach: ${escapeHtml(booking.coach?.name ?? "Coach")}</li>
        <li>Venue: ${escapeHtml(booking.venue?.name ?? "Venue")}</li>
        <li>When: ${escapeHtml(sessionSummary(booking))}</li>
      </ul>
      <p style="color:#5b6770">${escapeHtml(PAYMENT_COPY)}</p>
    </div>
  `;
}

export function buildBookingDeclinedPlayerEmailHtml(
  booking: CoachBookingRequest
): string {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#031322">
      <h1 style="font-size:20px">Request declined</h1>
      <p>Your coaching session request was declined.</p>
      <ul>
        <li>Coach: ${escapeHtml(booking.coach?.name ?? "Coach")}</li>
        <li>Venue: ${escapeHtml(booking.venue?.name ?? "Venue")}</li>
        <li>When: ${escapeHtml(sessionSummary(booking))}</li>
      </ul>
      <p>You can choose another available time on the coach profile.</p>
    </div>
  `;
}

export function buildBookingCancelledEmailHtml(
  booking: CoachBookingRequest,
  audience: "player" | "coach"
): string {
  const intro =
    audience === "player"
      ? "A coaching session request was cancelled."
      : "A player cancelled a coaching session request.";
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#031322">
      <h1 style="font-size:20px">Session cancelled</h1>
      <p>${intro}</p>
      <ul>
        <li>Coach: ${escapeHtml(booking.coach?.name ?? "Coach")}</li>
        <li>Venue: ${escapeHtml(booking.venue?.name ?? "Venue")}</li>
        <li>When: ${escapeHtml(sessionSummary(booking))}</li>
      </ul>
      <p style="color:#5b6770">${escapeHtml(PAYMENT_COPY)}</p>
    </div>
  `;
}

export async function sendBookingEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.ENQUIRY_FROM_EMAIL?.trim();
  if (!apiKey || !from || !input.to.trim()) {
    console.warn("[booking-email] skipped: missing Resend configuration or recipient");
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
      console.warn("[booking-email] send failed:", result.error.message);
    }
  } catch (error) {
    console.warn(
      "[booking-email] send failed:",
      error instanceof Error ? error.message : error
    );
  }
}
