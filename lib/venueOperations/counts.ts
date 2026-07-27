import { ymdInTimeZone } from "@/lib/coachAvailability/timezone";
import type {
  VenueBookingBlock,
  VenueBookingBlockWithCoach,
  VenueSessionListFilter,
} from "@/lib/venueOperations/types";

function isFuture(iso: string, nowMs: number): boolean {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t > nowMs;
}

function isPast(iso: string, nowMs: number): boolean {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t <= nowMs;
}

export function countRequestedFuture(
  blocks: VenueBookingBlock[],
  nowMs = Date.now()
): number {
  return blocks.filter(
    (b) => b.status === "requested" && isFuture(b.starts_at, nowMs)
  ).length;
}

export function countAcceptedFuture(
  blocks: VenueBookingBlock[],
  nowMs = Date.now()
): number {
  return blocks.filter(
    (b) => b.status === "accepted" && isFuture(b.starts_at, nowMs)
  ).length;
}

export function countCancelledRecent(
  blocks: VenueBookingBlock[],
  withinMs: number,
  nowMs = Date.now()
): number {
  const from = nowMs - withinMs;
  return blocks.filter((b) => {
    if (b.status !== "cancelled") return false;
    const cancelledAt = b.cancelled_at
      ? new Date(b.cancelled_at).getTime()
      : new Date(b.updated_at).getTime();
    return Number.isFinite(cancelledAt) && cancelledAt >= from && cancelledAt <= nowMs;
  }).length;
}

export function countCompletedPast(
  blocks: VenueBookingBlock[],
  nowMs = Date.now()
): number {
  return blocks.filter(
    (b) => b.status === "completed" && isPast(b.ends_at, nowMs)
  ).length;
}

export function nextAcceptedSession(
  blocks: VenueBookingBlockWithCoach[],
  nowMs = Date.now()
): VenueBookingBlockWithCoach | null {
  const future = blocks
    .filter((b) => b.status === "accepted" && isFuture(b.starts_at, nowMs))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return future[0] ?? null;
}

export function countAcceptedInWeek(
  blocks: VenueBookingBlock[],
  timezone: string,
  nowMs = Date.now()
): number {
  const nowIso = new Date(nowMs).toISOString();
  const todayYmd = ymdInTimeZone(nowIso, timezone);
  const weekEnd = new Date(nowMs + 7 * 24 * 60 * 60 * 1000).toISOString();
  const endYmd = ymdInTimeZone(weekEnd, timezone);

  return blocks.filter((b) => {
    if (b.status !== "accepted") return false;
    if (!isFuture(b.starts_at, nowMs)) return false;
    const day = ymdInTimeZone(b.starts_at, b.timezone || timezone);
    return day >= todayYmd && day <= endYmd;
  }).length;
}

export function filterSessionsByTab(
  blocks: VenueBookingBlockWithCoach[],
  tab: VenueSessionListFilter,
  nowMs = Date.now()
): VenueBookingBlockWithCoach[] {
  switch (tab) {
    case "upcoming":
      return blocks
        .filter(
          (b) =>
            (b.status === "requested" || b.status === "accepted") &&
            isFuture(b.starts_at, nowMs)
        )
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    case "awaiting":
      return blocks
        .filter(
          (b) => b.status === "requested" && isFuture(b.starts_at, nowMs)
        )
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    case "confirmed":
      return blocks
        .filter(
          (b) => b.status === "accepted" && isFuture(b.starts_at, nowMs)
        )
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    case "cancelled":
      return blocks
        .filter((b) => b.status === "cancelled")
        .sort((a, b) =>
          (b.cancelled_at ?? b.updated_at).localeCompare(
            a.cancelled_at ?? a.updated_at
          )
        );
    case "past":
      return blocks
        .filter(
          (b) =>
            b.status === "completed" ||
            ((b.status === "accepted" || b.status === "requested") &&
              isPast(b.ends_at, nowMs))
        )
        .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
    default:
      return [];
  }
}
