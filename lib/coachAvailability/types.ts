import type { AvailabilityExceptionType } from "@/lib/coachAvailability/constants";

export type AvailabilitySettings = {
  coach_venue_id: string;
  timezone: string;
  default_slot_duration_minutes: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type AvailabilityRule = {
  id: string;
  coach_venue_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AvailabilityException = {
  id: string;
  coach_venue_id: string;
  exception_type: AvailabilityExceptionType;
  starts_at: string;
  ends_at: string;
  slot_duration_minutes: number | null;
  created_at: string;
  updated_at: string;
};

export type AvailabilityVenueSummary = {
  relationshipId: string;
  venueId: string;
  venueName: string;
  city: string | null;
  country: string | null;
  settings: AvailabilitySettings | null;
  ruleCount: number;
  upcomingExceptionCount: number;
  weeklySummary: string[];
  nextSlotStartsAt: string | null;
};

export type DerivedSlot = {
  startsAt: string;
  endsAt: string;
  timezone: string;
  venueId: string;
  venueName: string;
  coachVenueId: string;
};

export type AvailabilityActionResult = {
  ok: boolean;
  message: string;
};

export type PublicVenueAvailabilityGroup = {
  venueId: string;
  venueName: string;
  city: string | null;
  country: string | null;
  timezone: string;
  days: Array<{
    date: string;
    label: string;
    slots: DerivedSlot[];
  }>;
};

export type PublicCoachAvailabilityCard = {
  coachId: string;
  coachName: string;
  role: string | null;
  imageUrl: string | null;
  timezone: string;
  nextSlot: DerivedSlot | null;
  isPublic: boolean;
  relationshipId: string;
};
