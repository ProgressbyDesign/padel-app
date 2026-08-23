import "server-only";

import { requireAdminPermission } from "@/lib/auth/adminSession";
import { createClient } from "@/lib/supabase/server";
import {
  mapCoachDirectoryRow,
  mapVenueDirectoryRow,
  type CoachDirectoryRaw,
  type ProfileDirectoryRow,
  type ProfileDirectoryStats,
  type VenueDirectoryRaw,
} from "@/lib/admin/profileDirectory";

const DIRECTORY_LIMIT = 2000;

const COACH_DIRECTORY_SELECT = `
  id,
  name,
  source,
  is_approved,
  launch_selection_status,
  publication_status,
  image_url,
  coach_locations ( city, country, is_primary )
`;

const VENUE_DIRECTORY_SELECT = `
  id,
  name,
  city,
  country,
  source,
  is_approved,
  launch_selection_status,
  publication_status,
  image_url
`;

/**
 * Admin coach directory. Intentionally does not apply public publication
 * filters — private imported profiles must remain visible to admins.
 */
export async function listAdminCoachDirectory(): Promise<ProfileDirectoryRow[]> {
  await requireAdminPermission("profiles.read");
  const supabase = await createClient();
  const [coachResult, membershipResult] = await Promise.all([
    supabase
      .from("coaches")
      .select(COACH_DIRECTORY_SELECT)
      .order("name", { ascending: true })
      .limit(DIRECTORY_LIMIT),
    supabase.from("coach_memberships").select("coach_id"),
  ]);

  if (coachResult.error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[admin] coach directory:", coachResult.error.message);
    }
    throw new Error("Unable to load coaches.");
  }

  const managedIds = new Set(
    (membershipResult.data ?? []).map((row) => String(row.coach_id))
  );

  return ((coachResult.data ?? []) as unknown as CoachDirectoryRaw[]).map(
    (raw) => {
      const row = mapCoachDirectoryRow(raw);
      return { ...row, hasAccount: managedIds.has(row.id) };
    }
  );
}

/**
 * Admin venue directory. Same visibility rules as coaches: no public
 * publication filter.
 */
export async function listAdminVenueDirectory(): Promise<ProfileDirectoryRow[]> {
  await requireAdminPermission("profiles.read");
  const supabase = await createClient();
  const [venueResult, membershipResult] = await Promise.all([
    supabase
      .from("venues")
      .select(VENUE_DIRECTORY_SELECT)
      .order("name", { ascending: true })
      .limit(DIRECTORY_LIMIT),
    supabase.from("venue_memberships").select("venue_id"),
  ]);

  if (venueResult.error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[admin] venue directory:", venueResult.error.message);
    }
    throw new Error("Unable to load venues.");
  }

  const managedIds = new Set(
    (membershipResult.data ?? []).map((row) => String(row.venue_id))
  );

  return ((venueResult.data ?? []) as unknown as VenueDirectoryRaw[]).map(
    (raw) => {
      const row = mapVenueDirectoryRow(raw);
      return { ...row, hasAccount: managedIds.has(row.id) };
    }
  );
}

export async function loadAdminProfileDirectoryStats(): Promise<{
  coaches: ProfileDirectoryStats;
  venues: ProfileDirectoryStats;
}> {
  await requireAdminPermission("profiles.read");
  const supabase = await createClient();

  const [
    coachTotal,
    coachSelected,
    coachPublished,
    venueTotal,
    venueSelected,
    venuePublished,
  ] = await Promise.all([
    countRows(supabase, "coaches"),
    countRows(supabase, "coaches", "launch_selection_status", "selected"),
    countRows(supabase, "coaches", "publication_status", "published"),
    countRows(supabase, "venues"),
    countRows(supabase, "venues", "launch_selection_status", "selected"),
    countRows(supabase, "venues", "publication_status", "published"),
  ]);

  return {
    coaches: {
      total: coachTotal,
      selected: coachSelected,
      published: coachPublished,
    },
    venues: {
      total: venueTotal,
      selected: venueSelected,
      published: venuePublished,
    },
  };
}

async function countRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "coaches" | "venues",
  column?: "launch_selection_status" | "publication_status",
  value?: string
): Promise<number> {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  if (column && value) query = query.eq(column, value);
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}
