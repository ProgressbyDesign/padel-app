import type { Coach } from "./coaches";
import type { CoachVenueLinkRow, VenueGeoRow } from "./coachVenueGeo";
import { normalizeEmbeddedVenue } from "./coachVenueGeo";
import type { Venue } from "./venueFilters";

function venueToGeoRow(v: Venue): VenueGeoRow {
  return {
    id: v.id,
    name: v.name ?? null,
    city: v.city ?? null,
    country: v.country ?? null,
    lat: v.lat ?? null,
    lng: v.lng ?? null,
    latitude: v.latitude ?? null,
    longitude: v.longitude ?? null,
  };
}

/** When PostgREST omits nested `venues`, resolve from the venues list by `venue_id`. */
export function hydrateCoachVenueEmbeds(coachRows: Coach[], venues: Venue[]): Coach[] {
  const byId = new Map(venues.map((v) => [String(v.id), venueToGeoRow(v)]));

  return coachRows.map((row) => {
    const links = row.coach_venues;
    if (!links?.length) return row;

    const hydrated: CoachVenueLinkRow[] = links.map((link) => {
      const embedded = normalizeEmbeddedVenue(link.venues);
      if (embedded?.city?.trim() || embedded?.country?.trim()) {
        return link;
      }
      const vid = link.venue_id != null ? String(link.venue_id) : null;
      if (vid && byId.has(vid)) {
        return { ...link, venues: byId.get(vid)! };
      }
      return link;
    });

    return { ...row, coach_venues: hydrated };
  });
}
