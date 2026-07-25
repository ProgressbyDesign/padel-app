import type { BookingStatus, PlayerLevel } from "@/lib/coachBookings/constants";

export type BookingCoachSummary = {
  id: string;
  name: string | null;
  role: string | null;
  image_url: string | null;
  price_from: number | null;
  email: string | null;
  phone: string | null;
};

export type BookingVenueSummary = {
  id: string;
  name: string | null;
  city: string | null;
  country: string | null;
};

export type CoachBookingRequest = {
  id: string;
  coach_venue_id: string;
  coach_id: string;
  venue_id: string;
  requester_user_id: string;
  status: BookingStatus;
  starts_at: string;
  ends_at: string;
  timezone: string;
  requester_name: string;
  requester_email: string;
  requester_phone: string | null;
  player_level: PlayerLevel | null;
  message: string | null;
  responded_at: string | null;
  cancelled_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  coach: BookingCoachSummary | null;
  venue: BookingVenueSummary | null;
};

export type BookingActionResult = {
  ok: boolean;
  message: string;
  bookingId?: string;
};

export type BookingSlotContext = {
  coachId: string;
  relationshipId: string;
  venueId: string;
  venueName: string;
  city: string | null;
  country: string | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  durationMinutes: number;
  priceFrom: number | null;
  coachName: string;
  coachRole: string | null;
  coachImageUrl: string | null;
};
