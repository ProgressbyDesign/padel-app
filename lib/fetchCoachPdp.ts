import { createClient } from "./supabase/server";
import { COACH_VENUES_WITH_VENUE_SELECT } from "./coachVenueGeo";
import { rawCoachRowToProfileView, type CoachPdpQueryRow, type CoachProfileView } from "./coachProfileView";
import { coachHasLivePublicAvailability } from "./queries/coachAvailability";

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
    ),

    ${COACH_VENUES_WITH_VENUE_SELECT}
  `;

/**
 * Load a coach for `/coach/[id]`. Tries nested relations first; if PostgREST errors
 * (missing table, RLS, etc.), falls back to `select("*")` so real rows still resolve.
 */
export async function fetchCoachPdpById(id: string): Promise<CoachProfileView | null> {
  const supabase = await createClient();
  const availability = await coachHasLivePublicAvailability(id);
  const availabilityLive = availability.status === "live";

  const nested = await supabase.from("coaches").select(COACH_PDP_NESTED_SELECT).eq("id", id).maybeSingle();
  if (!nested.error && nested.data) {
    return rawCoachRowToProfileView(nested.data as CoachPdpQueryRow, { availabilityLive });
  }

  const withVenues = await supabase
    .from("coaches")
    .select(`*, ${COACH_VENUES_WITH_VENUE_SELECT}`)
    .eq("id", id)
    .maybeSingle();
  if (!withVenues.error && withVenues.data) {
    return rawCoachRowToProfileView(withVenues.data as CoachPdpQueryRow, { availabilityLive });
  }

  const basic = await supabase.from("coaches").select("*").eq("id", id).maybeSingle();
  if (!basic.error && basic.data) {
    return rawCoachRowToProfileView(basic.data as CoachPdpQueryRow, { availabilityLive });
  }

  return null;
}
