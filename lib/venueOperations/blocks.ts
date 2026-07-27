import { isBookingStatus, type BookingStatus } from "@/lib/coachBookings/constants";
import type {
  VenueBookingBlock,
  VenueBookingBlockWithCoach,
} from "@/lib/venueOperations/types";

/** Columns that must never appear on venue-safe booking projections. */
export const VENUE_BLOCK_FORBIDDEN_FIELDS = [
  "requester_user_id",
  "requester_name",
  "requester_email",
  "requester_phone",
  "player_level",
  "message",
  "cancelled_by",
  "cancelled_by_user_id",
  "cancellation_actor",
] as const;

const SAFE_KEYS = [
  "booking_request_id",
  "coach_venue_id",
  "coach_id",
  "venue_id",
  "status",
  "starts_at",
  "ends_at",
  "timezone",
  "price_amount_minor",
  "currency",
  "requested_at",
  "responded_at",
  "cancelled_at",
  "completed_at",
  "updated_at",
] as const;

function asNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asNullableInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value)) return Number(value);
  return null;
}

/**
 * Map a raw row into a venue-safe booking block.
 * Explicitly drops any player-identity fields if present on the input.
 */
export function mapVenueBookingBlock(
  row: Record<string, unknown>
): VenueBookingBlock | null {
  const statusRaw = String(row.status ?? "");
  if (!isBookingStatus(statusRaw)) return null;

  const bookingRequestId = asNullableString(row.booking_request_id);
  const coachVenueId = asNullableString(row.coach_venue_id);
  const coachId = asNullableString(row.coach_id);
  const venueId = asNullableString(row.venue_id);
  const startsAt = asNullableString(row.starts_at);
  const endsAt = asNullableString(row.ends_at);
  const timezone = asNullableString(row.timezone);
  const requestedAt = asNullableString(row.requested_at);
  const updatedAt = asNullableString(row.updated_at);

  if (
    !bookingRequestId ||
    !coachVenueId ||
    !coachId ||
    !venueId ||
    !startsAt ||
    !endsAt ||
    !timezone ||
    !requestedAt ||
    !updatedAt
  ) {
    return null;
  }

  const mapped: VenueBookingBlock = {
    booking_request_id: bookingRequestId,
    coach_venue_id: coachVenueId,
    coach_id: coachId,
    venue_id: venueId,
    status: statusRaw as BookingStatus,
    starts_at: startsAt,
    ends_at: endsAt,
    timezone,
    price_amount_minor: asNullableInt(row.price_amount_minor),
    currency: asNullableString(row.currency),
    requested_at: requestedAt,
    responded_at: asNullableString(row.responded_at),
    cancelled_at: asNullableString(row.cancelled_at),
    completed_at: asNullableString(row.completed_at),
    updated_at: updatedAt,
  };

  // Defensive: ensure forbidden keys never leak through object spread consumers.
  for (const key of VENUE_BLOCK_FORBIDDEN_FIELDS) {
    if (key in mapped) {
      delete (mapped as Record<string, unknown>)[key];
    }
  }

  // Ensure only safe keys exist on the returned object.
  const safe: Record<string, unknown> = {};
  for (const key of SAFE_KEYS) {
    safe[key] = mapped[key];
  }
  return safe as VenueBookingBlock;
}

export function attachCoachToBlock(
  block: VenueBookingBlock,
  coach: {
    name?: string | null;
    role?: string | null;
    image_url?: string | null;
  } | null
): VenueBookingBlockWithCoach {
  return {
    ...block,
    coach_name: coach?.name?.trim() || "Coach",
    coach_role: coach?.role ?? null,
    coach_image_url: coach?.image_url ?? null,
  };
}

/** Active calendar blocks: requested + accepted only (not declined/cancelled/completed). */
export function isActiveCalendarBlockStatus(status: BookingStatus): boolean {
  return status === "requested" || status === "accepted";
}

export function filterBlocksForVenue(
  blocks: VenueBookingBlock[],
  venueId: string
): VenueBookingBlock[] {
  return blocks.filter((block) => block.venue_id === venueId);
}

export function activeCalendarBlocks(
  blocks: VenueBookingBlock[]
): VenueBookingBlock[] {
  return blocks.filter((block) => isActiveCalendarBlockStatus(block.status));
}

export function acceptedBlocks(blocks: VenueBookingBlock[]): VenueBookingBlock[] {
  return blocks.filter((block) => block.status === "accepted");
}

export function requestedBlocks(blocks: VenueBookingBlock[]): VenueBookingBlock[] {
  return blocks.filter((block) => block.status === "requested");
}

export function rangesOverlap(
  a: { startsAt: string; endsAt: string },
  b: { starts_at: string; ends_at: string }
): boolean {
  const aStart = new Date(a.startsAt).getTime();
  const aEnd = new Date(a.endsAt).getTime();
  const bStart = new Date(b.starts_at).getTime();
  const bEnd = new Date(b.ends_at).getTime();
  if (
    !Number.isFinite(aStart) ||
    !Number.isFinite(aEnd) ||
    !Number.isFinite(bStart) ||
    !Number.isFinite(bEnd)
  ) {
    return false;
  }
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Public/slot behaviour:
 * - accepted blocks the public slot
 * - requested does not block
 */
export function slotBlockedByAccepted(
  slot: { startsAt: string; endsAt: string; coachId?: string },
  blocks: VenueBookingBlock[]
): boolean {
  return acceptedBlocks(blocks).some((block) => {
    if (slot.coachId && block.coach_id !== slot.coachId) return false;
    return rangesOverlap(slot, block);
  });
}

export function requestedCountForSlot(
  slot: { startsAt: string; endsAt: string; coachId?: string },
  blocks: VenueBookingBlock[]
): number {
  return requestedBlocks(blocks).filter((block) => {
    if (slot.coachId && block.coach_id !== slot.coachId) return false;
    return rangesOverlap(slot, block);
  }).length;
}

export function durationMinutesFromBlock(block: VenueBookingBlock): number {
  const start = new Date(block.starts_at).getTime();
  const end = new Date(block.ends_at).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 60_000);
}

export function venueBlockStatusLabel(status: BookingStatus): string {
  switch (status) {
    case "requested":
      return "Request awaiting coach response";
    case "accepted":
      return "Reserved";
    case "declined":
      return "Declined";
    case "cancelled":
      return "Cancelled";
    case "completed":
      return "Completed";
    default:
      return status;
  }
}
