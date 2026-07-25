import "server-only";

import type { BlockedTimeRange } from "@/lib/coachAvailability/slots";
import { createClient } from "@/lib/supabase/server";

export async function loadAcceptedBlockedRangesForCoach(
  coachId: string,
  fromIso: string,
  toIso: string
): Promise<BlockedTimeRange[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_booking_requests")
    .select("starts_at, ends_at")
    .eq("coach_id", coachId)
    .eq("status", "accepted")
    .lt("starts_at", toIso)
    .gt("ends_at", fromIso);

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[bookings] accepted ranges failed:", error.message);
    }
    return [];
  }

  return (data ?? []).map((row) => ({
    startsAt: String(row.starts_at),
    endsAt: String(row.ends_at),
  }));
}

export async function loadAcceptedBlockedRangesForVenueRelationship(
  coachVenueId: string,
  fromIso: string,
  toIso: string
): Promise<BlockedTimeRange[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_booking_requests")
    .select("starts_at, ends_at")
    .eq("coach_venue_id", coachVenueId)
    .eq("status", "accepted")
    .lt("starts_at", toIso)
    .gt("ends_at", fromIso);

  if (error) return [];
  return (data ?? []).map((row) => ({
    startsAt: String(row.starts_at),
    endsAt: String(row.ends_at),
  }));
}

export async function loadRequestedCountsForRelationship(
  coachVenueId: string,
  fromIso: string,
  toIso: string
): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_booking_requests")
    .select("starts_at, ends_at")
    .eq("coach_venue_id", coachVenueId)
    .eq("status", "requested")
    .lt("starts_at", toIso)
    .gt("ends_at", fromIso);

  const map = new Map<string, number>();
  if (error) return map;
  for (const row of data ?? []) {
    const key = `${row.starts_at}|${row.ends_at}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}
