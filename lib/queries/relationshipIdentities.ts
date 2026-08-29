import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  COACH_PUBLIC_PROFILES_TABLE,
  VENUE_PUBLIC_PROFILES_TABLE,
  asPublicRows,
} from "@/lib/publicProfiles";
import { createClient } from "@/lib/supabase/server";

/** Authenticated identity for a linked coach. Not a public API. */
export const COACH_RELATIONSHIP_IDENTITIES_TABLE =
  "coach_relationship_identities";

/** Authenticated identity for a linked venue. Not a public API. */
export const VENUE_RELATIONSHIP_IDENTITIES_TABLE =
  "venue_relationship_identities";

export const COACH_IDENTITY_COLUMNS = ["id", "name", "role", "image_url"] as const;
export const VENUE_IDENTITY_COLUMNS = [
  "id",
  "name",
  "city",
  "country",
  "image_url",
] as const;

export const COACH_IDENTITY_SELECT = COACH_IDENTITY_COLUMNS.join(", ");
export const VENUE_IDENTITY_SELECT = VENUE_IDENTITY_COLUMNS.join(", ");

export type CoachRelationshipIdentity = {
  id: string;
  name: string | null;
  role: string | null;
  image_url: string | null;
};

export type VenueRelationshipIdentity = {
  id: string;
  name: string | null;
  city: string | null;
  country: string | null;
  image_url: string | null;
};

function uniqueIds(ids: Iterable<string | null | undefined>): string[] {
  return [...new Set([...ids].filter((id): id is string => Boolean(id)))];
}

function asCoachIdentity(row: Record<string, unknown>): CoachRelationshipIdentity {
  return {
    id: String(row.id),
    name: (row.name as string | null) ?? null,
    role: (row.role as string | null) ?? null,
    image_url: (row.image_url as string | null) ?? null,
  };
}

function asVenueIdentity(row: Record<string, unknown>): VenueRelationshipIdentity {
  return {
    id: String(row.id),
    name: (row.name as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    country: (row.country as string | null) ?? null,
    image_url: (row.image_url as string | null) ?? null,
  };
}

async function client(existing?: SupabaseClient): Promise<SupabaseClient> {
  return existing ?? (await createClient());
}

/**
 * Published public identity first; relationship-identity view fills Draft
 * or otherwise unpublished linked partners. Never reads the base table.
 */
export async function loadCoachRelationshipIdentities(
  ids: Iterable<string | null | undefined>,
  existing?: SupabaseClient
): Promise<Map<string, CoachRelationshipIdentity>> {
  const unique = uniqueIds(ids);
  const map = new Map<string, CoachRelationshipIdentity>();
  if (unique.length === 0) return map;

  const supabase = await client(existing);
  const { data: published } = await supabase
    .from(COACH_PUBLIC_PROFILES_TABLE)
    .select(COACH_IDENTITY_SELECT)
    .in("id", unique);

  for (const row of asPublicRows<Record<string, unknown>>(published)) {
    const identity = asCoachIdentity(row);
    map.set(identity.id, identity);
  }

  const missing = unique.filter((id) => !map.has(id));
  if (missing.length === 0) return map;

  const { data: identities } = await supabase
    .from(COACH_RELATIONSHIP_IDENTITIES_TABLE)
    .select(COACH_IDENTITY_SELECT)
    .in("id", missing);

  for (const row of asPublicRows<Record<string, unknown>>(identities)) {
    const identity = asCoachIdentity(row);
    map.set(identity.id, identity);
  }

  return map;
}

/**
 * Published public identity first; relationship-identity view fills Draft
 * or otherwise unpublished linked partners. Never reads the base table.
 */
export async function loadVenueRelationshipIdentities(
  ids: Iterable<string | null | undefined>,
  existing?: SupabaseClient
): Promise<Map<string, VenueRelationshipIdentity>> {
  const unique = uniqueIds(ids);
  const map = new Map<string, VenueRelationshipIdentity>();
  if (unique.length === 0) return map;

  const supabase = await client(existing);
  const { data: published } = await supabase
    .from(VENUE_PUBLIC_PROFILES_TABLE)
    .select(VENUE_IDENTITY_SELECT)
    .in("id", unique);

  for (const row of asPublicRows<Record<string, unknown>>(published)) {
    const identity = asVenueIdentity(row);
    map.set(identity.id, identity);
  }

  const missing = unique.filter((id) => !map.has(id));
  if (missing.length === 0) return map;

  const { data: identities } = await supabase
    .from(VENUE_RELATIONSHIP_IDENTITIES_TABLE)
    .select(VENUE_IDENTITY_SELECT)
    .in("id", missing);

  for (const row of asPublicRows<Record<string, unknown>>(identities)) {
    const identity = asVenueIdentity(row);
    map.set(identity.id, identity);
  }

  return map;
}
