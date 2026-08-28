/**
 * Public-safe coach/venue projections.
 *
 * Public acquisition surfaces must read `coach_public_profiles` /
 * `venue_public_profiles`, never the base tables. Admin, account, and
 * manager flows keep using `coaches` / `venues`.
 */

export const COACH_PUBLIC_PROFILES_TABLE = "coach_public_profiles";
export const VENUE_PUBLIC_PROFILES_TABLE = "venue_public_profiles";

/** Explicit allow-list matching public.coach_public_profiles. */
export const PUBLIC_COACH_COLUMNS = [
  "id",
  "name",
  "slug",
  "role",
  "description",
  "image_url",
  "level",
  "experience_years",
  "rating",
  "review_count",
  "travel_available",
  "price_from",
  "is_approved",
  "search_key",
  "publication_status",
] as const;

export const PUBLIC_COACH_SELECT = PUBLIC_COACH_COLUMNS.join(", ");

/** Explicit allow-list matching public.venue_public_profiles. */
export const PUBLIC_VENUE_COLUMNS = [
  "id",
  "name",
  "city",
  "country",
  "lat",
  "lng",
  "rating",
  "review_count",
  "image_url",
  "courts",
  "court_type",
  "coaching_available",
  "price",
  "coaching_description",
  "venue_type",
  "opening_hours",
  "opening_hours_structured",
  "address",
  "images",
  "is_approved",
  "search_key",
  "publication_status",
] as const;

export const PUBLIC_VENUE_SELECT = PUBLIC_VENUE_COLUMNS.join(", ");

export const PUBLIC_COACH_PRIVATE_COLUMNS = [
  "email",
  "phone",
  "created_at",
  "normalized_name",
  "source",
  "data_quality_status",
  "reviewed_at",
  "reviewed_by",
  "is_claimed",
  "launch_selection_status",
  "onboarding_status",
  "selected_at",
  "selected_by_user_id",
  "onboarding_started_at",
  "onboarding_completed_at",
  "published_at",
  "published_by_user_id",
] as const;

export const PUBLIC_VENUE_PRIVATE_COLUMNS = [
  "phone",
  "website",
  "created_at",
  "google_place_id",
  "ai_confidence",
  "last_synced_at",
  "last_crawled_at",
  "crawl_version",
  "source",
  "data_quality_status",
  "reviewed_at",
  "reviewed_by",
  "launch_selection_status",
  "onboarding_status",
  "selected_at",
  "selected_by_user_id",
  "onboarding_started_at",
  "onboarding_completed_at",
  "published_at",
  "published_by_user_id",
] as const;

export type PublicCoachRow = {
  id: string;
  name: string | null;
  slug: string | null;
  role: string | null;
  description: string | null;
  image_url: string | null;
  level: string | null;
  experience_years: number | string | null;
  rating: number | string | null;
  review_count: number | null;
  travel_available: boolean | null;
  price_from: string | number | null;
  is_approved: boolean | null;
  search_key: string | null;
  publication_status: "published";
};

export type PublicVenueRow = {
  id: string;
  name: string | null;
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | string | null;
  review_count: number | null;
  image_url: string | null;
  courts: number | null;
  court_type: string | null;
  coaching_available: boolean | null;
  price: string | number | null;
  coaching_description: string | null;
  venue_type: string | null;
  opening_hours: unknown;
  opening_hours_structured: unknown;
  address: string | null;
  images: string[] | null;
  is_approved: boolean | null;
  search_key: string | null;
  publication_status: "published";
};

export function asPublicRows<T>(data: unknown): T[] {
  return (Array.isArray(data) ? data : []) as T[];
}

export function asPublicRow<T extends object>(data: unknown): T | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  return data as T;
}
