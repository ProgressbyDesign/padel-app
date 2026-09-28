import { PAYMENT_COPY } from "@/lib/coachBookings/constants";
import type { CoachBookingRequest } from "@/lib/coachBookings/types";
import { formatInTimeZone } from "@/lib/coachAvailability/timezone";
import {
  PADEL_PATHWAYS_REPLY_TO,
  PADEL_PATHWAYS_SENDER,
  brandedEmailTemplate,
  emailTestCopies,
  type BrandedEmailDetail,
} from "@/lib/notifications/brandedEmail";
import { configuredAppOrigin } from "@/lib/notifications/emailDelivery";
import { sendProductEmail } from "@/lib/notifications/productEmail";

function sessionDetails(
  booking: CoachBookingRequest,
  extra: BrandedEmailDetail[] = []
): BrandedEmailDetail[] {
  const date = formatInTimeZone(booking.starts_at, booking.timezone, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const time = formatInTimeZone(booking.starts_at, booking.timezone, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return [
    { label: "Coach", value: booking.coach?.name?.trim() || "Coach" },
    { label: "Venue", value: booking.venue?.name?.trim() || "Venue" },
    { label: "Date", value: date },
    { label: "Time", value: time },
    { label: "Timezone", value: booking.timezone },
    ...extra,
  ];
}

function bookingHtml(input: {
  title: string;
  paragraphs: string[];
  details: BrandedEmailDetail[];
  note?: string | null;
  noteLabel?: string;
  actionLabel: string;
  path: string;
  includePayment?: boolean;
}): string {
  const origin = configuredAppOrigin();
  const paragraphs = input.includePayment
    ? [...input.paragraphs, PAYMENT_COPY]
    : input.paragraphs;
  return brandedEmailTemplate({
    title: input.title,
    paragraphs,
    details: input.details,
    note: input.note,
    noteLabel: input.noteLabel,
    origin,
    actionLabel: input.actionLabel,
    actionUrl: origin ? `${origin}${input.path}` : input.path,
    eyebrow: "YOUR NEXT SESSION",
  });
}

export function buildBookingRequestCoachEmailHtml(
  booking: CoachBookingRequest
): string {
  const extra: BrandedEmailDetail[] = [
    { label: "Player", value: booking.requester_name },
    { label: "Email", value: booking.requester_email },
  ];
  if (booking.requester_phone?.trim()) {
    extra.push({ label: "Phone", value: booking.requester_phone.trim() });
  }
  return bookingHtml({
    title: "New coaching session request",
    paragraphs: [
      `${booking.requester_name.trim() || "A player"} requested a coaching session.`,
      "Review the request and respond from your coach bookings.",
    ],
    details: sessionDetails(booking, extra),
    note: booking.message,
    noteLabel: "Message",
    actionLabel: "Review request",
    path: `/account/coaches/${encodeURIComponent(booking.coach_id)}/bookings`,
    includePayment: true,
  });
}

export function buildBookingRequestPlayerEmailHtml(
  booking: CoachBookingRequest
): string {
  return bookingHtml({
    title: "Coaching request sent",
    paragraphs: [
      "Your coaching session request has been sent.",
      "It is waiting for the coach to review. The coach will contact you about confirmation and payment.",
    ],
    details: sessionDetails(booking),
    actionLabel: "View my request",
    path: `/account/bookings/${encodeURIComponent(booking.id)}`,
    includePayment: true,
  });
}

export function buildBookingAcceptedPlayerEmailHtml(
  booking: CoachBookingRequest
): string {
  return bookingHtml({
    title: "Your coaching request was accepted",
    paragraphs: [
      "The coach accepted your session request.",
      "Contact the coach to confirm payment and the final arrangements. Padel Pathways does not take payment for this session.",
    ],
    details: sessionDetails(booking),
    actionLabel: "View my request",
    path: `/account/bookings/${encodeURIComponent(booking.id)}`,
    includePayment: true,
  });
}

export function buildBookingDeclinedPlayerEmailHtml(
  booking: CoachBookingRequest
): string {
  return bookingHtml({
    title: "Your coaching request wasn't available this time",
    paragraphs: [
      "The coach couldn't take this session.",
      "You can look for another available time on the coach profile.",
    ],
    details: sessionDetails(booking),
    actionLabel: "View coach profile",
    path: `/coach/${encodeURIComponent(booking.coach_id)}`,
  });
}

export function buildBookingCancelledEmailHtml(
  booking: CoachBookingRequest,
  audience: "player" | "coach",
  cancelledBy?: "player" | "coach" | "admin"
): string {
  const playerCancelled = cancelledBy === "player";
  const intro =
    audience === "coach"
      ? playerCancelled
        ? "The player cancelled this coaching session request."
        : "This coaching session request was cancelled."
      : playerCancelled
        ? "You cancelled this coaching session request."
        : "This coaching session request was cancelled.";
  return bookingHtml({
    title: "Coaching session cancelled",
    paragraphs: [
      intro,
      "The request stays in your booking history.",
    ],
    details: sessionDetails(booking),
    actionLabel: audience === "coach" ? "Open coach bookings" : "View my request",
    path:
      audience === "coach"
        ? `/account/coaches/${encodeURIComponent(booking.coach_id)}/bookings`
        : `/account/bookings/${encodeURIComponent(booking.id)}`,
    includePayment: true,
  });
}

export async function sendBookingEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const origin = configuredAppOrigin();
  if (!/^https?:\/\//.test(origin)) {
    console.warn("[booking-email] Missing NEXT_PUBLIC_APP_URL; email not sent.");
    return;
  }
  if (!input.to.trim()) {
    console.warn("[booking-email] skipped: missing recipient");
    return;
  }
  await sendProductEmail({
    to: input.to,
    subject: input.subject,
    html: input.html,
    from: PADEL_PATHWAYS_SENDER,
    replyTo: PADEL_PATHWAYS_REPLY_TO,
    bcc: emailTestCopies(input.to),
    logLabel: "booking-email",
  });
}
