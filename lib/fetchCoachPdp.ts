import { createClient } from "./supabase/server";
import {
  rawCoachRowToProfileView,
  type CoachPdpQueryRow,
  type CoachProfileView,
} from "./coachProfileView";
import { applyPublishedCoachFilter } from "./lifecycle/publicationFilters";
import { coachHasDisplayedPublicAvailability } from "./queries/coachAvailability";
import { attachPublicCoachVenueRelationships } from "./queries/publicCoachVenues";

const COACH_PDP_NESTED_SELECT = `
    id,
    name,
    slug,
    role,
    description,
    email,
    phone,
    level,
    experience_years,
    rating,
    review_count,
    price_from,
    travel_available,
    image_url,
    is_approved,
    is_claimed,

    coach_attributes (
      audience_adults,
      audience_juniors,
      player_levels
    ),

    coach_outcomes (
      outcome,
      outcome_key
    ),

    coach_achievements (
      title,
      description,
      year,
      is_highlight
    ),

    coach_images (
      image_url,
      is_primary
    ),

    coach_locations (
      country,
      city,
      is_primary
    ),

    coach_socials (
      id,
      coach_id,
      platform,
      url,
      is_primary,
      created_at
    )
  `;

/**
 * Load a coach for `/coach/[id]`. Tries nested relations first; if PostgREST errors
 * (missing table, RLS, etc.), falls back to `select("*")` so real rows still resolve.
 * Venue relationships are loaded via the public relationship loader.
 */
export async function fetchCoachPdpById(id: string): Promise<CoachProfileView | null> {
  const supabase = await createClient();
  const availability = await coachHasDisplayedPublicAvailability(id);
  const availabilityLive = availability.status === "live";

  let nestedQuery = supabase.from("coaches").select(COACH_PDP_NESTED_SELECT).eq("id", id);
  nestedQuery = applyPublishedCoachFilter(nestedQuery);
  const nested = await nestedQuery.maybeSingle();
  if (!nested.error && nested.data) {
    const [withVenues] = await attachPublicCoachVenueRelationships(
      [nested.data as CoachPdpQueryRow],
      supabase
    );
    return rawCoachRowToProfileView(withVenues, { availabilityLive });
  }

  let basicQuery = supabase.from("coaches").select("*").eq("id", id);
  basicQuery = applyPublishedCoachFilter(basicQuery);
  const basic = await basicQuery.maybeSingle();
  if (!basic.error && basic.data) {
    const [withVenues] = await attachPublicCoachVenueRelationships(
      [basic.data as CoachPdpQueryRow],
      supabase
    );
    return rawCoachRowToProfileView(withVenues, { availabilityLive });
  }

  return null;
}
