import "server-only";

import {
  isBookingStatus,
  isPlayerLevel,
  type BookingStatus,
  type PlayerLevel,
} from "@/lib/coachBookings/constants";
import type {
  BookingSlotContext,
  CoachBookingRequest,
} from "@/lib/coachBookings/types";
import type { PricingSource } from "@/lib/coachAvailability/pricing";
import {
  deriveAvailabilitySlots,
} from "@/lib/coachAvailability/slots";
import {
  loadAcceptedBlockedRangesForCoach,
} from "@/lib/queries/coachBookingBlocks";
import {
  loadAvailabilityExceptions,
  loadAvailabilityRules,
  loadAvailabilitySettings,
} from "@/lib/queries/coachAvailability";
import { createClient } from "@/lib/supabase/server";

export {
  loadAcceptedBlockedRangesForCoach,
  loadAcceptedBlockedRangesForVenueRelationship,
  loadRequestedCountsForRelationship,
} from "@/lib/queries/coachBookingBlocks";

const PRICING_SOURCES = new Set<PricingSource>([
  "default_hourly_rate",
  "rule_override",
  "exception_override",
]);

const BOOKING_SELECT = `
  id,
  coach_venue_id,
  coach_id,
  venue_id,
  requester_user_id,
  status,
  starts_at,
  ends_at,
  timezone,
  requester_name,
  requester_email,
  requester_phone,
  player_level,
  message,
  price_amount_minor,
  currency,
  pricing_source,
  responded_at,
  cancelled_at,
  completed_at,
  created_at,
  updated_at,
  coaches (
    id,
    name,
    role,
    image_url,
    price_from,
    email,
    phone
  ),
  venues (
    id,
    name,
    city,
    country
  )
`;

function asPricingSource(value: unknown): PricingSource | null {
  return typeof value === "string" && PRICING_SOURCES.has(value as PricingSource)
    ? (value as PricingSource)
    : null;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function asCoachBookingRequest(
  row: Record<string, unknown>
): CoachBookingRequest {
  const coach = one(
    row.coaches as Record<string, unknown> | Record<string, unknown>[] | null
  );
  const venue = one(
    row.venues as Record<string, unknown> | Record<string, unknown>[] | null
  );
  const statusRaw = String(row.status ?? "");
  const levelRaw = row.player_level == null ? null : String(row.player_level);

  return {
    id: String(row.id),
    coach_venue_id: String(row.coach_venue_id),
    coach_id: String(row.coach_id),
    venue_id: String(row.venue_id),
    requester_user_id: String(row.requester_user_id),
    status: (isBookingStatus(statusRaw) ? statusRaw : "requested") as BookingStatus,
    starts_at: String(row.starts_at),
    ends_at: String(row.ends_at),
    timezone: String(row.timezone),
    requester_name: String(row.requester_name),
    requester_email: String(row.requester_email),
    requester_phone: (row.requester_phone as string | null) ?? null,
    player_level:
      levelRaw && isPlayerLevel(levelRaw) ? (levelRaw as PlayerLevel) : null,
    message: (row.message as string | null) ?? null,
    price_amount_minor:
      row.price_amount_minor == null ? null : Number(row.price_amount_minor),
    currency: (row.currency as string | null) ?? null,
    pricing_source: asPricingSource(row.pricing_source),
    responded_at: (row.responded_at as string | null) ?? null,
    cancelled_at: (row.cancelled_at as string | null) ?? null,
    completed_at: (row.completed_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    coach: coach
      ? {
          id: String(coach.id),
          name: (coach.name as string | null) ?? null,
          role: (coach.role as string | null) ?? null,
          image_url: (coach.image_url as string | null) ?? null,
          price_from:
            coach.price_from == null ? null : Number(coach.price_from),
          email: (coach.email as string | null) ?? null,
          phone: (coach.phone as string | null) ?? null,
        }
      : null,
    venue: venue
      ? {
          id: String(venue.id),
          name: (venue.name as string | null) ?? null,
          city: (venue.city as string | null) ?? null,
          country: (venue.country as string | null) ?? null,
        }
      : null,
  };
}

export async function validateBookableSlot(input: {
  coachId: string;
  relationshipId: string;
  startsAt: string;
}): Promise<BookingSlotContext | null> {
  const supabase = await createClient();
  const { data: link, error } = await supabase
    .from("coach_venues")
    .select(
      `
      id,
      coach_id,
      venue_id,
      status,
      coaches ( id, name, role, image_url, price_from ),
      venues ( id, name, city, country )
    `
    )
    .eq("id", input.relationshipId)
    .eq("coach_id", input.coachId)
    .maybeSingle();

  if (error || !link || link.status !== "active") return null;

  const settings = await loadAvailabilitySettings(input.relationshipId);
  if (!settings?.is_public) return null;

  const [rules, exceptions] = await Promise.all([
    loadAvailabilityRules(input.relationshipId),
    loadAvailabilityExceptions(input.relationshipId),
  ]);

  const coach = one(
    link.coaches as Record<string, unknown> | Record<string, unknown>[] | null
  );
  const venue = one(
    link.venues as Record<string, unknown> | Record<string, unknown>[] | null
  );
  const venueId = String(link.venue_id);
  const venueName = String(venue?.name ?? "Venue");

  const rangeStart = new Date(input.startsAt);
  if (Number.isNaN(rangeStart.getTime())) return null;
  const rangeEnd = new Date(rangeStart.getTime() + 14 * 24 * 60 * 60 * 1000);
  const blockedRanges = await loadAcceptedBlockedRangesForCoach(
    input.coachId,
    new Date(rangeStart.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    rangeEnd.toISOString()
  );

  const slots = deriveAvailabilitySlots({
    settings,
    rules,
    exceptions,
    venueId,
    venueName,
    days: 14,
    blockedRanges,
  });

  const match = slots.find((slot) => slot.startsAt === input.startsAt);
  if (!match) return null;

  const durationMinutes = Math.round(
    (new Date(match.endsAt).getTime() - new Date(match.startsAt).getTime()) /
      60_000
  );

  return {
    coachId: input.coachId,
    relationshipId: input.relationshipId,
    venueId,
    venueName,
    city: (venue?.city as string | null) ?? null,
    country: (venue?.country as string | null) ?? null,
    startsAt: match.startsAt,
    endsAt: match.endsAt,
    timezone: match.timezone,
    durationMinutes,
    priceFrom: coach?.price_from == null ? null : Number(coach.price_from),
    priceAmountMinor: match.priceAmountMinor,
    currency: match.currency,
    coachName: String(coach?.name ?? "Coach"),
    coachRole: (coach?.role as string | null) ?? null,
    coachImageUrl: (coach?.image_url as string | null) ?? null,
  };
}

export async function loadBookingById(
  bookingId: string
): Promise<CoachBookingRequest | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_booking_requests")
    .select(BOOKING_SELECT)
    .eq("id", bookingId)
    .maybeSingle();
  if (error || !data) return null;
  return asCoachBookingRequest(data as Record<string, unknown>);
}

export async function loadPlayerBookings(
  userId: string
): Promise<CoachBookingRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_booking_requests")
    .select(BOOKING_SELECT)
    .eq("requester_user_id", userId)
    .order("starts_at", { ascending: true });
  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[bookings] load player bookings failed:", error.message);
    }
    throw new Error("Unable to load bookings.");
  }
  return ((data ?? []) as Record<string, unknown>[]).map(asCoachBookingRequest);
}

export async function loadCoachBookings(
  coachId: string
): Promise<CoachBookingRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_booking_requests")
    .select(BOOKING_SELECT)
    .eq("coach_id", coachId)
    .order("starts_at", { ascending: true });
  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[bookings] load coach bookings failed:", error.message);
    }
    throw new Error("Unable to load coach bookings.");
  }
  return ((data ?? []) as Record<string, unknown>[]).map(asCoachBookingRequest);
}

export type AdminBookingFilters = {
  status?: string | null;
  coach?: string | null;
  venue?: string | null;
};

export async function listAdminBookings(
  filters: AdminBookingFilters = {}
): Promise<CoachBookingRequest[]> {
  const supabase = await createClient();
  let query = supabase
    .from("coach_booking_requests")
    .select(BOOKING_SELECT)
    .order("created_at", { ascending: false })
    .limit(200);

  const status = filters.status?.trim();
  if (status && isBookingStatus(status)) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[bookings] load admin bookings failed:", error.message);
    }
    throw new Error("Unable to load bookings.");
  }

  let rows = ((data ?? []) as Record<string, unknown>[]).map(
    asCoachBookingRequest
  );

  const coachFilter = filters.coach?.trim().toLowerCase();
  if (coachFilter) {
    rows = rows.filter((row) =>
      (row.coach?.name ?? "").toLowerCase().includes(coachFilter)
    );
  }
  const venueFilter = filters.venue?.trim().toLowerCase();
  if (venueFilter) {
    rows = rows.filter((row) =>
      (row.venue?.name ?? "").toLowerCase().includes(venueFilter)
    );
  }

  return rows;
}

export function partitionPlayerBookings(bookings: CoachBookingRequest[]): {
  upcoming: CoachBookingRequest[];
  past: CoachBookingRequest[];
} {
  const now = Date.now();
  const upcoming: CoachBookingRequest[] = [];
  const past: CoachBookingRequest[] = [];

  for (const booking of bookings) {
    const startMs = new Date(booking.starts_at).getTime();
    const isFuture = startMs >= now;
    if (
      (booking.status === "requested" || booking.status === "accepted") &&
      isFuture
    ) {
      upcoming.push(booking);
    } else {
      past.push(booking);
    }
  }

  past.sort(
    (a, b) =>
      new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()
  );
  return { upcoming, past };
}

export function partitionCoachBookings(bookings: CoachBookingRequest[]): {
  newRequests: CoachBookingRequest[];
  upcoming: CoachBookingRequest[];
  past: CoachBookingRequest[];
} {
  const now = Date.now();
  const newRequests: CoachBookingRequest[] = [];
  const upcoming: CoachBookingRequest[] = [];
  const past: CoachBookingRequest[] = [];

  for (const booking of bookings) {
    const startMs = new Date(booking.starts_at).getTime();
    const isFuture = startMs >= now;
    if (booking.status === "requested" && isFuture) {
      newRequests.push(booking);
    } else if (booking.status === "accepted" && isFuture) {
      upcoming.push(booking);
    } else {
      past.push(booking);
    }
  }

  past.sort(
    (a, b) =>
      new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()
  );
  return { newRequests, upcoming, past };
}

export async function loadBookingAttention(userId: string): Promise<{
  playerAwaiting: number;
  playerAcceptedUpcoming: number;
  coachNewRequests: Array<{ coachId: string; coachName: string; count: number }>;
  coachAcceptedUpcoming: Array<{
    coachId: string;
    coachName: string;
    count: number;
  }>;
}> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [{ data: playerRows }, { data: memberships }] = await Promise.all([
    supabase
      .from("coach_booking_requests")
      .select("id, status, starts_at")
      .eq("requester_user_id", userId)
      .in("status", ["requested", "accepted"])
      .gte("starts_at", nowIso),
    supabase
      .from("coach_memberships")
      .select("coach_id, coaches ( id, name )")
      .eq("user_id", userId),
  ]);

  const playerAwaiting = (playerRows ?? []).filter(
    (row) => row.status === "requested"
  ).length;
  const playerAcceptedUpcoming = (playerRows ?? []).filter(
    (row) => row.status === "accepted"
  ).length;

  const coachIds = (memberships ?? []).map((row) => String(row.coach_id));
  const coachNameById = new Map<string, string>();
  for (const row of memberships ?? []) {
    const coach = one(
      row.coaches as { id: string; name: string | null } | { id: string; name: string | null }[] | null
    );
    coachNameById.set(
      String(row.coach_id),
      coach?.name?.trim() || "Coach profile"
    );
  }

  const coachNewRequests: Array<{
    coachId: string;
    coachName: string;
    count: number;
  }> = [];
  const coachAcceptedUpcoming: Array<{
    coachId: string;
    coachName: string;
    count: number;
  }> = [];

  if (coachIds.length > 0) {
    const { data: coachBookings } = await supabase
      .from("coach_booking_requests")
      .select("coach_id, status, starts_at")
      .in("coach_id", coachIds)
      .in("status", ["requested", "accepted"])
      .gte("starts_at", nowIso);

    const newByCoach = new Map<string, number>();
    const acceptedByCoach = new Map<string, number>();
    for (const row of coachBookings ?? []) {
      const id = String(row.coach_id);
      if (row.status === "requested") {
        newByCoach.set(id, (newByCoach.get(id) ?? 0) + 1);
      } else if (row.status === "accepted") {
        acceptedByCoach.set(id, (acceptedByCoach.get(id) ?? 0) + 1);
      }
    }
    for (const [coachId, count] of newByCoach) {
      coachNewRequests.push({
        coachId,
        coachName: coachNameById.get(coachId) ?? "Coach profile",
        count,
      });
    }
    for (const [coachId, count] of acceptedByCoach) {
      coachAcceptedUpcoming.push({
        coachId,
        coachName: coachNameById.get(coachId) ?? "Coach profile",
        count,
      });
    }
  }

  return {
    playerAwaiting,
    playerAcceptedUpcoming,
    coachNewRequests,
    coachAcceptedUpcoming,
  };
}

/** Whether another accepted booking already owns this exact/overlapping slot. */
export async function hasAcceptedCompetitor(
  coachId: string,
  startsAt: string,
  endsAt: string,
  excludeBookingId?: string
): Promise<boolean> {
  const supabase = await createClient();
  let query = supabase
    .from("coach_booking_requests")
    .select("id")
    .eq("coach_id", coachId)
    .eq("status", "accepted")
    .lt("starts_at", endsAt)
    .gt("ends_at", startsAt)
    .limit(1);
  if (excludeBookingId) query = query.neq("id", excludeBookingId);
  const { data } = await query;
  return (data ?? []).length > 0;
}
