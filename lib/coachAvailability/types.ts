import type { AvailabilityExceptionType } from "@/lib/coachAvailability/constants";
import type { PricingSource } from "@/lib/coachAvailability/pricing";

export type AvailabilitySettings = {
  coach_venue_id: string;
  timezone: string;
  default_slot_duration_minutes: number;
  is_public: boolean;
  currency: string | null;
  default_hourly_rate_minor: number | null;
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
  price_override_minor: number | null;
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
  price_override_minor: number | null;
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
  priceAmountMinor: number | null;
  currency: string | null;
  pricingSource: PricingSource | null;
  /** Present when slot came from an available exception (for coach diagnostics). */
  fromException?: boolean;
  ruleId?: string | null;
  exceptionId?: string | null;
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
  days: Array<{
    date: string;
    label: string;
    slots: DerivedSlot[];
  }>;
};

/** Coach-centric public availability at a venue (day-grouped slots). */
export type PublicCoachAvailabilityGroup = PublicCoachAvailabilityCard;

/** Combined venue-manager calendar slot (no requester PII). */
export type VenueCombinedAvailabilityPreviewSlot = {
  startsAt: string;
  endsAt: string;
  timezone: string;
  venueId?: string;
  venueName?: string;
  priceAmountMinor: number | null;
  currency: string | null;
  state?: "available" | "reserved";
  coachId: string;
  coachName: string;
  coachImageUrl: string | null;
  relationshipId: string;
};
