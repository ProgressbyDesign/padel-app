import "server-only";

import {
  COACH_VENUE_INITIATORS,
  COACH_VENUE_STATUSES,
  isCoachVenueStatus,
  type CoachVenueStatus,
} from "@/lib/coachVenues/constants";
import {
  asCoachVenueRelationship,
} from "@/lib/queries/coachVenueRelationships";
import type { CoachVenueRelationship } from "@/lib/coachVenues/types";
import { requireAdminAccount } from "@/lib/auth/adminSession";
import { createClient } from "@/lib/supabase/server";

const ADMIN_RELATIONSHIP_SELECT = `
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

export type AdminRelationshipFilters = {
  status?: string | null;
  initiatedBy?: string | null;
  coach?: string | null;
  venue?: string | null;
};

export type AdminRelationshipListItem = CoachVenueRelationship & {
  requesterLabel: string | null;
  responderLabel: string | null;
};

function sanitize(term: string): string {
  return term
    .trim()
    .replace(/[%_,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function profileLabels(
  userIds: string[]
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", unique);
  for (const row of data ?? []) {
    const name =
      typeof row.full_name === "string" && row.full_name.trim()
        ? row.full_name.trim()
        : String(row.id).slice(0, 8);
    map.set(String(row.id), name);
  }
  return map;
}

export async function listAdminCoachVenueRelationships(
  filters: AdminRelationshipFilters = {}
): Promise<AdminRelationshipListItem[]> {
  await requireAdminAccount();
  const supabase = await createClient();

  let query = supabase
    .from("coach_venues")
    .select(ADMIN_RELATIONSHIP_SELECT)
    .order("requested_at", { ascending: false })
    .limit(200);

  const status = filters.status?.trim();
  if (status === "past") {
    query = query.in("status", ["declined", "cancelled", "ended"]);
  } else if (status && isCoachVenueStatus(status)) {
    query = query.eq("status", status);
  }

  const initiatedBy = filters.initiatedBy?.trim();
  if (
    initiatedBy &&
    (COACH_VENUE_INITIATORS as readonly string[]).includes(initiatedBy)
  ) {
    query = query.eq("initiated_by", initiatedBy);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Unable to load relationships: ${error.message}`);
  }

  let rows = ((data ?? []) as Record<string, unknown>[]).map(
    asCoachVenueRelationship
  );

  const coachFilter = sanitize(filters.coach ?? "");
  if (coachFilter) {
    const needle = coachFilter.toLowerCase();
    rows = rows.filter((row) =>
      (row.coach?.name ?? "").toLowerCase().includes(needle)
    );
  }

  const venueFilter = sanitize(filters.venue ?? "");
  if (venueFilter) {
    const needle = venueFilter.toLowerCase();
    rows = rows.filter((row) =>
      (row.venue?.name ?? "").toLowerCase().includes(needle)
    );
  }

  const labels = await profileLabels(
    rows.flatMap((row) =>
      [row.requested_by_user_id, row.responded_by_user_id].filter(
        (id): id is string => Boolean(id)
      )
    )
  );

  return rows.map((row) => ({
    ...row,
    requesterLabel: row.requested_by_user_id
      ? labels.get(row.requested_by_user_id) ?? null
      : null,
    responderLabel: row.responded_by_user_id
      ? labels.get(row.responded_by_user_id) ?? null
      : null,
  }));
}

export async function loadAdminRelationshipDetail(
  relationshipId: string
): Promise<{
  relationship: AdminRelationshipListItem;
  coachHasMembership: boolean;
  venueHasMembership: boolean;
} | null> {
  await requireAdminAccount();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_venues")
    .select(ADMIN_RELATIONSHIP_SELECT)
    .eq("id", relationshipId)
    .maybeSingle();
  if (error || !data) return null;

  const relationship = asCoachVenueRelationship(data as Record<string, unknown>);
  const labels = await profileLabels(
    [relationship.requested_by_user_id, relationship.responded_by_user_id].filter(
      (id): id is string => Boolean(id)
    )
  );

  const [{ count: coachMembershipCount }, { count: venueMembershipCount }] =
    await Promise.all([
      supabase
        .from("coach_memberships")
        .select("user_id", { count: "exact", head: true })
        .eq("coach_id", relationship.coach_id),
      supabase
        .from("venue_memberships")
        .select("user_id", { count: "exact", head: true })
        .eq("venue_id", relationship.venue_id),
    ]);

  return {
    relationship: {
      ...relationship,
      requesterLabel: relationship.requested_by_user_id
        ? labels.get(relationship.requested_by_user_id) ?? null
        : null,
      responderLabel: relationship.responded_by_user_id
        ? labels.get(relationship.responded_by_user_id) ?? null
        : null,
    },
    coachHasMembership: (coachMembershipCount ?? 0) > 0,
    venueHasMembership: (venueMembershipCount ?? 0) > 0,
  };
}

export async function countAdminRelationshipBuckets(): Promise<
  Record<"pending" | "unverified" | "active" | "past", number>
> {
  await requireAdminAccount();
  const supabase = await createClient();
  const statuses: CoachVenueStatus[] = [...COACH_VENUE_STATUSES];
  const counts = await Promise.all(
    statuses.map(async (status) => {
      const { count } = await supabase
        .from("coach_venues")
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      return [status, count ?? 0] as const;
    })
  );
  const byStatus = Object.fromEntries(counts) as Record<CoachVenueStatus, number>;
  return {
    pending: byStatus.pending ?? 0,
    unverified: byStatus.unverified ?? 0,
    active: byStatus.active ?? 0,
    past:
      (byStatus.declined ?? 0) +
      (byStatus.cancelled ?? 0) +
      (byStatus.ended ?? 0),
  };
}

export type AdminEntitySearchResult = {
  id: string;
  name: string;
  secondary: string | null;
};

export async function searchAdminCoachesForRelationship(
  term: string
): Promise<AdminEntitySearchResult[]> {
  await requireAdminAccount();
  const safe = sanitize(term);
  if (safe.length < 2) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coaches")
    .select("id, name, role")
    .ilike("name", `%${safe}%`)
    .order("name", { ascending: true })
    .limit(12);
  if (error) return [];
  return (data ?? [])
    .filter((row) => row.name?.trim())
    .map((row) => ({
      id: String(row.id),
      name: String(row.name).trim(),
      secondary: (row.role as string | null) ?? null,
    }));
}

export async function searchAdminVenuesForRelationship(
  term: string
): Promise<AdminEntitySearchResult[]> {
  await requireAdminAccount();
  const safe = sanitize(term);
  if (safe.length < 2) return [];
  const supabase = await createClient();
  const pattern = `%${safe}%`;
  const quoted = `"${pattern.replace(/"/g, "")}"`;
  const { data, error } = await supabase
    .from("venues")
    .select("id, name, city, country")
    .or(`name.ilike.${quoted},city.ilike.${quoted},country.ilike.${quoted}`)
    .order("name", { ascending: true })
    .limit(12);
  if (error) {
    const fallback = await supabase
      .from("venues")
      .select("id, name, city, country")
      .ilike("name", pattern)
      .order("name", { ascending: true })
      .limit(12);
    if (fallback.error) return [];
    return mapVenues(fallback.data ?? []);
  }
  return mapVenues(data ?? []);
}

function mapVenues(
  rows: { id: string; name: string | null; city: string | null; country: string | null }[]
): AdminEntitySearchResult[] {
  return rows
    .filter((row) => row.name?.trim())
    .map((row) => ({
      id: String(row.id),
      name: String(row.name).trim(),
      secondary: [row.city, row.country].filter(Boolean).join(", ") || null,
    }));
}
