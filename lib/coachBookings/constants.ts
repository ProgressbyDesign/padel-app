export const BOOKING_STATUSES = [
  "requested",
  "accepted",
  "declined",
  "cancelled",
  "completed",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PLAYER_LEVELS = [
  "beginner",
  "intermediate",
  "advanced",
  "competitive_professional",
] as const;

export type PlayerLevel = (typeof PLAYER_LEVELS)[number];

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  requested: "Awaiting coach response",
  accepted: "Accepted — arrange payment with coach",
  declined: "Declined",
  cancelled: "Cancelled",
  completed: "Completed",
};

export const PLAYER_LEVEL_LABELS: Record<PlayerLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  competitive_professional: "Competitive / professional",
};

export const PAYMENT_COPY =
  "Payment and final arrangements are handled directly with the coach.";

export function isBookingStatus(value: string): value is BookingStatus {
  return (BOOKING_STATUSES as readonly string[]).includes(value);
}

export function isPlayerLevel(value: string): value is PlayerLevel {
  return (PLAYER_LEVELS as readonly string[]).includes(value);
}
