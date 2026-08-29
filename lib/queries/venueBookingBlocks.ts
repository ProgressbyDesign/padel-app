import "server-only";

import { attachCoachToBlock, mapVenueBookingBlock } from "@/lib/venueOperations/blocks";
import type {
  VenueBookingBlock,
  VenueBookingBlockWithCoach,
} from "@/lib/venueOperations/types";
import { createClient } from "@/lib/supabase/server";
import { loadManagedVenueShell } from "@/lib/queries/managedVenueShell";
import { loadCoachRelationshipIdentities } from "@/lib/queries/relationshipIdentities";

const BLOCK_SELECT = `
  booking_request_id,
  coach_venue_id,
  coach_id,
  venue_id,
  status,
  starts_at,
  ends_at,
  timezone,
  price_amount_minor,
  currency,
  requested_at,
  responded_at,
  cancelled_at,
  completed_at,
  updated_at
`;

export async function loadVenueBookingBlocks(
  venueId: string,
  options?: {
    fromIso?: string;
    toIso?: string;
    statuses?: string[];
  }
): Promise<VenueBookingBlock[]> {
  const shell = await loadManagedVenueShell(venueId);
  if (!shell) return [];

  const supabase = await createClient();
  let query = supabase
    .from("venue_booking_blocks")
    .select(BLOCK_SELECT)
    .eq("venue_id", venueId)
    .order("starts_at", { ascending: true });

  if (options?.fromIso) {
    query = query.gt("ends_at", options.fromIso);
  }
  if (options?.toIso) {
    query = query.lt("starts_at", options.toIso);
  }
  if (options?.statuses?.length) {
    query = query.in("status", options.statuses);
  }

  const { data, error } = await query;
  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[venue-blocks] load failed:", error.message);
    }
    return [];
  }

  const blocks: VenueBookingBlock[] = [];
  for (const row of data ?? []) {
    const mapped = mapVenueBookingBlock(row as Record<string, unknown>);
    if (mapped) blocks.push(mapped);
  }
  return blocks;
}

export async function loadVenueBookingBlocksWithCoaches(
  venueId: string,
  options?: {
    fromIso?: string;
    toIso?: string;
    statuses?: string[];
  }
): Promise<VenueBookingBlockWithCoach[]> {
  const blocks = await loadVenueBookingBlocks(venueId, options);
  if (blocks.length === 0) return [];

  const coachIds = [...new Set(blocks.map((b) => b.coach_id))];
  const identities = await loadCoachRelationshipIdentities(coachIds);

  const coachMap = new Map(
    [...identities.entries()].map(([id, coach]) => [
      id,
      {
        name: coach.name,
        role: coach.role,
        image_url: coach.image_url,
      },
    ])
  );

  return blocks.map((block) =>
    attachCoachToBlock(block, coachMap.get(block.coach_id) ?? null)
  );
}

export async function loadVenueBookingBlockDetail(
  venueId: string,
  bookingRequestId: string
): Promise<VenueBookingBlockWithCoach | null> {
  const shell = await loadManagedVenueShell(venueId);
  if (!shell) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("venue_booking_blocks")
    .select(BLOCK_SELECT)
    .eq("venue_id", venueId)
    .eq("booking_request_id", bookingRequestId)
    .maybeSingle();

  if (error || !data) return null;
  const block = mapVenueBookingBlock(data as Record<string, unknown>);
  if (!block) return null;

  const identities = await loadCoachRelationshipIdentities([block.coach_id]);
  const coach = identities.get(block.coach_id) ?? null;

  return attachCoachToBlock(block, coach);
}
