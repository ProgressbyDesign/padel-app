/**
 * Application payload → API / server action.
 * Use `CoachApplicationRow` for admin reads and approval workflows later.
 */
export type CoachApplicationMediaAttachment = {
  filename: string;
  content_type: string;
  data_base64: string;
};

export type CoachApplicationSubmitPayload = {
  service_type: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  based_in: string;
  operates_multiple_locations: boolean;
  additional_locations: string | null;
  services_offered: string[];
  offering_description: string;
  player_levels: string[];
  player_types_specialty: string[];
  price_range_per_week: string;
  accommodation_offered: boolean;
  full_packages_offered: boolean;
  availability_type: string;
  seasonal_availability_detail: string | null;
  capacity_per_week: string;
  website_url: string | null;
  social_media_links: string | null;
  media_attachments: CoachApplicationMediaAttachment[];
  achievements: string | null;
  special_offer_promoted: boolean;
  special_offer_description: string | null;
  lead_delivery_preference: string;
  paid_leads_openness: string;
  main_goal: string;
};

/** Row shape aligned with `public.coach_applications` for future admin UI. */
export type CoachApplicationRow = {
  id: string;
  created_at: string;
  status: string;
  service_type: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  based_in: string;
  operates_multiple_locations: boolean;
  additional_locations: string | null;
  services_offered: string[];
  offering_description: string;
  player_levels: string[];
  player_types_specialty: string[];
  price_range_per_week: string;
  accommodation_offered: boolean;
  full_packages_offered: boolean;
  availability_type: string;
  seasonal_availability_detail: string | null;
  capacity_per_week: string;
  website_url: string | null;
  social_media_links: string | null;
  media_attachments: unknown;
  achievements: string | null;
  special_offer_promoted: boolean;
  special_offer_description: string | null;
  lead_delivery_preference: string;
  paid_leads_openness: string;
  main_goal: string;
  raw_payload: unknown;
};
