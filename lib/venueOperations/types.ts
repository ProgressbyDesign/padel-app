import type { BookingStatus } from "@/lib/coachBookings/constants";

/** Venue-safe booking projection — never includes player identity fields. */
export type VenueBookingBlock = {
  booking_request_id: string;
  coach_venue_id: string;
  coach_id: string;
  venue_id: string;
  status: BookingStatus;
  starts_at: string;
  ends_at: string;
  timezone: string;
  price_amount_minor: number | null;
  currency: string | null;
  requested_at: string;
  responded_at: string | null;
  cancelled_at: string | null;
  completed_at: string | null;
  updated_at: string;
};

export type VenueBookingBlockWithCoach = VenueBookingBlock & {
  coach_name: string;
  coach_role: string | null;
  coach_image_url: string | null;
};

export type CoachAvailabilityHealthState =
  | "ready"
  | "hidden"
  | "no_future_availability"
  | "not_configured"
  | "needs_response";

export type CoachAvailabilityHealth = {
  relationshipId: string;
  coachId: string;
  coachName: string;
  coachRole: string | null;
  coachImageUrl: string | null;
  state: CoachAvailabilityHealthState;
  settingsConfigured: boolean;
  isPublic: boolean;
  activeRuleCount: number;
  futureExtraCount: number;
  nextFutureSlotStartsAt: string | null;
  acceptedNext30Days: number;
  requestedAwaitingResponse: number;
  lastScheduleUpdateAt: string | null;
  timezone: string | null;
};

export type VenueOpsSummary = {
  activeCoaches: number;
  publicCoaches: number;
  hiddenSchedules: number;
  notConfigured: number;
  sessionsThisWeek: number;
  confirmedFuture: number;
  pendingRelationships: number;
  importedUnverified: number;
  nextSession: VenueBookingBlockWithCoach | null;
  cancelledNextSevenDays: number;
  requestedAwaitingCoach: number;
  noFutureSessions: boolean;
};

export type VenueAlertKind =
  | "hidden_schedules"
  | "no_future_availability"
  | "awaiting_coach_response"
  | "imported_unverified"
  | "cancelled_this_week"
  | "invitation_awaiting"
  | "not_configured"
  | "schedule_hidden"
  | "no_future_sessions";

export type VenueAlert = {
  id: string;
  kind: VenueAlertKind;
  message: string;
  href: string;
};

export type VenueSessionListFilter =
  | "upcoming"
  | "awaiting"
  | "confirmed"
  | "cancelled"
  | "past";

export type VenueScheduleVisibilityFilter = "all" | "public" | "hidden";
export type VenueScheduleStateFilter = "available" | "reserved" | "requested";

export type VenueOperationalCalendarSlot = {
  startsAt: string;
  endsAt: string;
  timezone: string;
  venueId: string;
  venueName: string;
  priceAmountMinor: number | null;
  currency: string | null;
  /** Snapshot price for reserved/requested rows from venue_booking_blocks. */
  bookedPriceAmountMinor?: number | null;
  bookedCurrency?: string | null;
  state: "available" | "reserved" | "requested";
  visibility: "public" | "hidden";
  coachId: string;
  coachName: string;
  coachRole: string | null;
  coachImageUrl: string | null;
  relationshipId: string;
  durationMinutes: number;
  bookingRequestId?: string;
  requestedAt?: string;
  respondedAt?: string | null;
  requestedCount?: number;
};
