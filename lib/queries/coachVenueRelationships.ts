import "server-only";

import {
  CURRENT_COACH_VENUE_STATUSES,
  PAST_COACH_VENUE_STATUSES,
  PUBLIC_COACH_VENUE_STATUSES,
  isCoachVenueStatus,
  type CoachVenueInitiator,
  type CoachVenueStatus,
} from "@/lib/coachVenues/constants";
import type {
  CoachVenueBoard,
  CoachVenueCoachSummary,
  CoachVenueRelationship,
  CoachVenueSearchCoach,
  CoachVenueSearchVenue,
  CoachVenueVenueSummary,
} from "@/lib/coachVenues/types";
import { normalizeEmbeddedVenue } from "@/lib/coachVenueGeo";
import {
  COACH_PUBLIC_PROFILES_TABLE,
  VENUE_PUBLIC_PROFILES_TABLE,
} from "@/lib/publicProfiles";
import { loadPublicCoachVenueRelationships } from "@/lib/queries/publicCoachVenues";
import { createClient } from "@/lib/supabase/server";

const RELATIONSHIP_SELECT = `
  id,
  coach_id,
  venue_id,
  is_primary,
  status,
  initiated_by,
  requested_by_user_id,
  responded_by_user_id,
  requested_at,
  responded_at,
  ended_at,
  venues (
    id,
    name,
    city,
    country,
    image_url,
    website
  ),
  coaches (
    id,
    name,
    role,
    image_url
  )
`;

function one<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function asVenue(
  row: Record<string, unknown> | null
): CoachVenueVenueSummary | null {
  if (!row) return null;
  return {
    id: String(row.id),
    name: (row.name as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    country: (row.country as string | null) ?? null,
    image_url: (row.image_url as string | null) ?? null,
    website: (row.website as string | null) ?? null,
  };
}

function asCoach(
  row: Record<string, unknown> | null
): CoachVenueCoachSummary | null {
  if (!row) return null;
  return {
    id: String(row.id),
    name: (row.name as string | null) ?? null,
    role: (row.role as string | null) ?? null,
    image_url: (row.image_url as string | null) ?? null,
  };
}

export function asCoachVenueRelationship(
  row: Record<string, unknown>
): CoachVenueRelationship {
  const statusRaw = String(row.status ?? "");
  const initiatorRaw = String(row.initiated_by ?? "");
  return {
    id: String(row.id),
    coach_id: String(row.coach_id),
    venue_id: String(row.venue_id),
    is_primary: Boolean(row.is_primary),
    status: (isCoachVenueStatus(statusRaw) ? statusRaw : "pending") as CoachVenueStatus,
    initiated_by: initiatorRaw as CoachVenueInitiator,
    requested_by_user_id: (row.requested_by_user_id as string | null) ?? null,
    responded_by_user_id: (row.responded_by_user_id as string | null) ?? null,
    requested_at: (row.requested_at as string | null) ?? null,
    responded_at: (row.responded_at as string | null) ?? null,
    ended_at: (row.ended_at as string | null) ?? null,
    venue: asVenue(
      one(row.venues as Record<string, unknown> | Record<string, unknown>[] | null)
    ),
    coach: asCoach(
      one(row.coaches as Record<string, unknown> | Record<string, unknown>[] | null)
    ),
  };
}

function sortCurrent(a: CoachVenueRelationship, b: CoachVenueRelationship) {
  if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
  if (a.status !== b.status) {
    if (a.status === "active") return -1;
    if (b.status === "active") return 1;
  }
  const an = a.venue?.name ?? a.coach?.name ?? "";
  const bn = b.venue?.name ?? b.coach?.name ?? "";
  return an.localeCompare(bn);
}

function partitionBoard(rows: CoachVenueRelationship[]): CoachVenueBoard {
  const current: CoachVenueRelationship[] = [];
  const incoming: CoachVenueRelationship[] = [];
  const outgoing: CoachVenueRelationship[] = [];
  const past: CoachVenueRelationship[] = [];

  for (const row of rows) {
    if (row.status === "active" || row.status === "unverified") {
      current.push(row);
      continue;
    }
    if (row.status === "pending") {
      // Partition by initiator happens in coach/venue specific loaders.
      incoming.push(row);
      continue;
    }
    if ((PAST_COACH_VENUE_STATUSES as readonly string[]).includes(row.status)) {
      past.push(row);
    }
  }

  current.sort(sortCurrent);
  past.sort((a, b) =>
    String(b.ended_at ?? b.responded_at ?? "").localeCompare(
      String(a.ended_at ?? a.responded_at ?? "")
    )
  );

  return { current, incoming, outgoing, past };
}

export async function loadCoachRelationshipBoard(
  coachId: string
): Promise<CoachVenueBoard> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_venues")
    .select(RELATIONSHIP_SELECT)
    .eq("coach_id", coachId)
    .order("requested_at", { ascending: false });

  if (error) {
    throw new Error(`Unable to load coach venues: ${error.message}`);
  }

  const rows = ((data ?? []) as Record<string, unknown>[]).map(
    asCoachVenueRelationship
  );
  const board = partitionBoard(rows);
  const incoming = rows.filter(
    (row) => row.status === "pending" && row.initiated_by === "venue"
  );
  const outgoing = rows.filter(
    (row) => row.status === "pending" && row.initiated_by === "coach"
  );
  return {
    current: board.current,
    incoming,
    outgoing,
    past: board.past,
  };
}

export async function loadVenueRelationshipBoard(
  venueId: string
): Promise<CoachVenueBoard> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_venues")
    .select(RELATIONSHIP_SELECT)
    .eq("venue_id", venueId)
    .order("requested_at", { ascending: false });

  if (error) {
    throw new Error(`Unable to load venue coaches: ${error.message}`);
  }

  const rows = ((data ?? []) as Record<string, unknown>[]).map(
    asCoachVenueRelationship
  );
  const board = partitionBoard(rows);
  const incoming = rows.filter(
    (row) => row.status === "pending" && row.initiated_by === "coach"
  );
  const outgoing = rows.filter(
    (row) => row.status === "pending" && row.initiated_by === "venue"
  );
  return {
    current: board.current,
    incoming,
    outgoing,
    past: board.past,
  };
}

export async function loadCoachVenueById(
  relationshipId: string
): Promise<CoachVenueRelationship | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_venues")
    .select(RELATIONSHIP_SELECT)
    .eq("id", relationshipId)
    .maybeSingle();
  if (error || !data) return null;
  return asCoachVenueRelationship(data as Record<string, unknown>);
}

function sanitizeSearchTerm(term: string): string {
  return term
    .trim()
    .replace(/[%_,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function managedVenueIdsForUser(
  userId: string | null | undefined,
  venueIds: string[]
): Promise<Set<string>> {
  if (!userId || venueIds.length === 0) return new Set();
  const supabase = await createClient();
  const { data } = await supabase
    .from("venue_memberships")
    .select("venue_id")
    .eq("user_id", userId)
    .in("venue_id", venueIds);
  return new Set((data ?? []).map((row) => String(row.venue_id)));
}

async function managedCoachIdsForUser(
  userId: string | null | undefined,
  coachIds: string[]
): Promise<Set<string>> {
  if (!userId || coachIds.length === 0) return new Set();
  const supabase = await createClient();
  const { data } = await supabase
    .from("coach_memberships")
    .select("coach_id")
    .eq("user_id", userId)
    .in("coach_id", coachIds);
  return new Set((data ?? []).map((row) => String(row.coach_id)));
}

export async function searchVenuesForCoachRelationship(
  coachId: string,
  term: string
): Promise<CoachVenueSearchVenue[]> {
  const safe = sanitizeSearchTerm(term);
  if (safe.length < 2) return [];

  const supabase = await createClient();
  const pattern = `%${safe}%`;
  const quoted = `"${pattern.replace(/"/g, "")}"`;

  const [{ data: authData }, { data: venues, error }, { data: links }] =
    await Promise.all([
      supabase.auth.getClaims(),
      supabase
        .from(VENUE_PUBLIC_PROFILES_TABLE)
        .select("id, name, city, country, image_url")
        .or(`name.ilike.${quoted},city.ilike.${quoted},country.ilike.${quoted}`)
        .order("name", { ascending: true })
        .limit(12),
      supabase
        .from("coach_venues")
        .select("venue_id, status")
        .eq("coach_id", coachId)
        .in("status", [...CURRENT_COACH_VENUE_STATUSES]),
    ]);

  const userId =
    typeof authData?.claims?.sub === "string" ? authData.claims.sub : null;

  if (error) {
    const fallback = await supabase
      .from(VENUE_PUBLIC_PROFILES_TABLE)
      .select("id, name, city, country, image_url")
      .ilike("name", pattern)
      .order("name", { ascending: true })
      .limit(12);
    if (fallback.error) return [];
    const managedIds = await managedVenueIdsForUser(
      userId,
      (fallback.data ?? []).map((row) => String(row.id))
    );
    return mapVenueSearch(fallback.data ?? [], links ?? [], managedIds);
  }

  const managedIds = await managedVenueIdsForUser(
    userId,
    (venues ?? []).map((row) => String(row.id))
  );
  return mapVenueSearch(venues ?? [], links ?? [], managedIds);
}

function mapVenueSearch(
  venues: {
    id: string;
    name: string | null;
    city: string | null;
    country: string | null;
    image_url: string | null;
  }[],
  links: { venue_id: string; status: string }[],
  managedIds: Set<string>
): CoachVenueSearchVenue[] {
  const byVenue = new Map(
    links.map((link) => [
      link.venue_id,
      isCoachVenueStatus(link.status) ? link.status : null,
    ])
  );
  return venues
    .filter((venue) => venue.name?.trim())
    .map((venue) => ({
      id: venue.id,
      name: venue.name!.trim(),
      city: venue.city,
      country: venue.country,
      image_url: venue.image_url,
      existingStatus: byVenue.get(venue.id) ?? null,
      managedByCurrentUser: managedIds.has(venue.id),
    }));
}

export async function searchCoachesForVenueRelationship(
  venueId: string,
  term: string
): Promise<CoachVenueSearchCoach[]> {
  const safe = sanitizeSearchTerm(term);
  if (safe.length < 2) return [];

  const supabase = await createClient();
  const pattern = `%${safe}%`;

  const [{ data: authData }, { data: coaches, error }, { data: links }] =
    await Promise.all([
      supabase.auth.getClaims(),
      supabase
        .from(COACH_PUBLIC_PROFILES_TABLE)
        .select("id, name, role, image_url")
        .ilike("name", pattern)
        .order("name", { ascending: true })
        .limit(12),
      supabase
        .from("coach_venues")
        .select("coach_id, status")
        .eq("venue_id", venueId)
        .in("status", [...CURRENT_COACH_VENUE_STATUSES]),
    ]);

  if (error) return [];

  const userId =
    typeof authData?.claims?.sub === "string" ? authData.claims.sub : null;
  const coachIds = (coaches ?? []).map((row) => String(row.id));
  const managedIds = await managedCoachIdsForUser(userId, coachIds);
  const venuesByCoach = await loadPublicCoachVenueRelationships(coachIds, supabase);

  const byCoach = new Map(
    (links ?? []).map((link) => [
      link.coach_id as string,
      isCoachVenueStatus(String(link.status))
        ? (link.status as CoachVenueStatus)
        : null,
    ])
  );

  return (coaches ?? [])
    .filter((coach) => coach.name?.trim())
    .map((coach) => {
      const coachId = String(coach.id);
      const venueLinks = venuesByCoach.get(coachId) ?? [];
      const primary =
        venueLinks.find((link) => link.is_primary) ?? venueLinks[0] ?? null;
      const venue = normalizeEmbeddedVenue(primary?.venues);
      const location = [venue?.city, venue?.country]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(", ");

      return {
        id: coachId,
        name: String(coach.name).trim(),
        role: (coach.role as string | null) ?? null,
        image_url: (coach.image_url as string | null) ?? null,
        location: location || null,
        existingStatus: byCoach.get(coachId) ?? null,
        managedByCurrentUser: managedIds.has(coachId),
      };
    });
}

export { PUBLIC_COACH_VENUE_STATUSES, CURRENT_COACH_VENUE_STATUSES };
