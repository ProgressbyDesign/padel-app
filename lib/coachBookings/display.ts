import { formatInTimeZone } from "@/lib/coachAvailability/timezone";
import {
  BOOKING_STATUS_LABELS,
  PLAYER_LEVEL_LABELS,
  type BookingStatus,
} from "@/lib/coachBookings/constants";
import type { CoachBookingRequest } from "@/lib/coachBookings/types";

export function formatBookingWhen(booking: CoachBookingRequest): string {
  return formatInTimeZone(booking.starts_at, booking.timezone, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

export function formatBookingDateTime(booking: CoachBookingRequest): string {
  return formatInTimeZone(booking.starts_at, booking.timezone, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

export function playerStatusLabel(
  booking: CoachBookingRequest,
  competitorAccepted: boolean
): string {
  if (booking.status === "requested" && competitorAccepted) {
    return "Awaiting coach response — this time may no longer be available.";
  }
  return BOOKING_STATUS_LABELS[booking.status];
}

export function statusTone(status: BookingStatus): string {
  switch (status) {
    case "accepted":
      return "bg-emerald-50 text-emerald-900 border-emerald-200";
    case "requested":
      return "bg-amber-50 text-amber-950 border-amber-200";
    case "declined":
    case "cancelled":
      return "bg-primary/5 text-primary/70 border-primary/10";
    case "completed":
      return "bg-sky-50 text-sky-950 border-sky-200";
    default:
      return "bg-primary/5 text-primary/70 border-primary/10";
  }
}

export function playerLevelLabel(
  level: CoachBookingRequest["player_level"]
): string | null {
  if (!level) return null;
  return PLAYER_LEVEL_LABELS[level];
}
