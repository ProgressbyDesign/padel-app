import "server-only";

import {
  formatCoachLocationLabel,
  sortCoachLocations,
  type CoachLocationRow,
} from "@/lib/coachLocations";
import { isValidCoachId, loadManagedCoachShell } from "@/lib/queries/managedCoachShell";
import { createClient } from "@/lib/supabase/server";

export async function loadManagedCoachLocations(
  coachId: string
): Promise<CoachLocationRow[] | null> {
  const shell = await loadManagedCoachShell(coachId);
  if (!shell) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_locations")
    .select("id, coach_id, country, city, is_primary, created_at")
    .eq("coach_id", coachId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Unable to load coach locations: ${error.message}`);
  }

  return sortCoachLocations(
    (data ?? []).map((row) => ({
      id: String(row.id),
      coach_id: String(row.coach_id),
      country: String(row.country),
      city: String(row.city),
      is_primary: Boolean(row.is_primary),
      created_at: String(row.created_at),
    }))
  );
}

export async function loadPublicCoachLocations(
  coachId: string
): Promise<CoachLocationRow[]> {
  if (!isValidCoachId(coachId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_locations")
    .select("id, coach_id, country, city, is_primary, created_at")
    .eq("coach_id", coachId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) return [];
  return sortCoachLocations(
    (data ?? []).map((row) => ({
      id: String(row.id),
      coach_id: String(row.coach_id),
      country: String(row.country),
      city: String(row.city),
      is_primary: Boolean(row.is_primary),
      created_at: String(row.created_at),
    }))
  );
}

export function primaryLocationLabel(
  locations: CoachLocationRow[]
): string | null {
  const primary = locations.find((row) => row.is_primary) ?? locations[0];
  return primary ? formatCoachLocationLabel(primary) : null;
}
