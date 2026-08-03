import type {
  LaunchSelectionStatus,
  OnboardingStatus,
  PublicationStatus,
} from "@/lib/lifecycle/constants";

export const DATA_QUALITY_OPTIONS = [
  "pending",
  "needs_review",
  "approved",
  "rejected",
] as const;

export type DataQualityStatus = (typeof DATA_QUALITY_OPTIONS)[number];

/** Sprint 6A lifecycle fields — independent of approval / data quality / claim. */
export type AdminLifecycleFields = {
  launch_selection_status?: LaunchSelectionStatus | string | null;
  onboarding_status?: OnboardingStatus | string | null;
  publication_status?: PublicationStatus | string | null;
  selected_at?: string | null;
  selected_by_user_id?: string | null;
  onboarding_started_at?: string | null;
  onboarding_completed_at?: string | null;
  published_at?: string | null;
  published_by_user_id?: string | null;
};

export type AdminVenueRow = {
  id: string;
  name: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  courts: number | null;
  court_type: string | null;
  venue_type: string | null;
  ai_confidence: number | null;
  is_approved: boolean | null;
  data_quality_status: string | null;
  last_crawled_at: string | null;
  description?: string | null;
  coaching_available?: boolean | null;
  coaching_description?: string | null;
  price?: string | null;
} & AdminLifecycleFields;

export type AdminVenueDetail = AdminVenueRow & {
  description: string | null;
  coaching_available: boolean | null;
  coaching_description: string | null;
  price: string | null;
  phone: string | null;
  address: string | null;
  reviewed_at: string | null;
};

export type VenueSocialRow = {
  id: string;
  venue_id: string;
  platform: string;
  url: string;
  is_primary: boolean | null;
};

export type AdminCoachRow = {
  id: string;
  name: string | null;
  role: string | null;
  level: string | null;
  email: string | null;
  phone: string | null;
  price_from: string | null;
  image_url: string | null;
  is_approved: boolean | null;
  data_quality_status: string | null;
  coach_venues?: { venue_id: string; is_primary: boolean | null; venues: { id: string; name: string | null; city: string | null; country: string | null } | { id: string; name: string | null; city: string | null; country: string | null }[] | null }[] | null;
} & AdminLifecycleFields;

export type AdminCoachDetail = {
  id: string;
  name: string | null;
  role: string | null;
  description: string | null;
  level: string | null;
  experience_years: number | null;
  price_from: string | null;
  email: string | null;
  phone: string | null;
  image_url: string | null;
  is_approved: boolean | null;
  data_quality_status: string | null;
  reviewed_at: string | null;
} & AdminLifecycleFields;

export type CoachVenueLinkRow = {
  id?: string;
  coach_id: string;
  venue_id: string;
  is_primary: boolean | null;
  venues?: { id: string; name: string | null; city: string | null; country: string | null; website?: string | null } | null;
};

export type CoachOutcomeRow = { id: string; coach_id: string; outcome: string };
export type CoachSocialRow = { id: string; coach_id: string; platform: string; url: string; is_primary: boolean | null };
export type CoachImageRow = { id: string; coach_id: string; image_url: string; is_primary: boolean | null };

export type AdminDashboardStats = {
  venueCount: number;
  coachCount: number;
  coachesWithoutVenue: number;
  coachesWithoutImage: number;
  venuesWithoutSocials: number;
  coachesNeedingReview: number;
  venuesNeedingReview: number;
};

export type VenueSuggestion = {
  venueId: string;
  venueName: string;
  city: string | null;
  country: string | null;
  website: string | null;
  reason: "email_domain" | "description";
  reasonLabel: string;
};

export type CoachForLinking = {
  id: string;
  name: string | null;
  image_url: string | null;
  email: string | null;
  phone: string | null;
  description: string | null;
  linkedVenueCount: number;
  suggestions: VenueSuggestion[];
};

export type ReviewQueueFilter =
  | "coaches_without_venue"
  | "coaches_without_image"
  | "coaches_low_confidence"
  | "venues_without_socials"
  | "venues_needing_review"
  | "approved";
