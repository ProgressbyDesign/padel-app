import type { PublicVenueRow } from "@/lib/publicProfiles";
import type { PublicVenue } from "@/lib/venueFilters";

export function mapPublicVenueRow(row: PublicVenueRow): PublicVenue {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    country: row.country,
    lat: row.lat,
    lng: row.lng,
    rating: row.rating,
    review_count: row.review_count,
    image_url: row.image_url,
    courts: row.courts,
    court_type: row.court_type,
    coaching_available: row.coaching_available,
    coaching_description: row.coaching_description,
    venue_type: row.venue_type,
    opening_hours: row.opening_hours,
    opening_hours_structured: row.opening_hours_structured,
    address: row.address,
    images: row.images,
    is_approved: row.is_approved,
  };
}
