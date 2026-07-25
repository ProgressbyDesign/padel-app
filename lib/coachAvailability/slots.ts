import type {
  AvailabilityException,
  AvailabilityRule,
  AvailabilitySettings,
  DerivedSlot,
} from "@/lib/coachAvailability/types";
import {
  addLocalDays,
  addMinutesToHm,
  compareHm,
  hmInTimeZone,
  isoWeekdayForLocalDate,
  minutesBetweenHm,
  normalizeTimeHm,
  todayYmdInTimeZone,
  ymdInTimeZone,
  zonedLocalToUtc,
} from "@/lib/coachAvailability/timezone";

type SlotRange = { startMs: number; endMs: number };

function overlaps(a: SlotRange, b: SlotRange): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

function generateWindowsForDate(
  dateYmd: string,
  rules: AvailabilityRule[],
  timeZone: string
): Array<{ startHm: string; endHm: string; duration: number }> {
  const weekday = isoWeekdayForLocalDate(dateYmd, timeZone);
  const windows: Array<{ startHm: string; endHm: string; duration: number }> = [];

  for (const rule of rules) {
    if (!rule.is_active) continue;
    if (rule.day_of_week !== weekday) continue;
    if (rule.valid_from > dateYmd) continue;
    if (rule.valid_until && rule.valid_until < dateYmd) continue;
    windows.push({
      startHm: normalizeTimeHm(rule.start_time),
      endHm: normalizeTimeHm(rule.end_time),
      duration: rule.slot_duration_minutes,
    });
  }

  return windows;
}

function slotsFromWindow(
  dateYmd: string,
  startHm: string,
  endHm: string,
  duration: number,
  timeZone: string
): SlotRange[] {
  if (compareHm(startHm, endHm) >= 0) return [];
  if (minutesBetweenHm(startHm, endHm) < duration) return [];

  const ranges: SlotRange[] = [];
  let cursor = startHm;
  while (minutesBetweenHm(cursor, endHm) >= duration) {
    const next = addMinutesToHm(cursor, duration);
    if (compareHm(next, endHm) > 0) break;
    const start = zonedLocalToUtc(dateYmd, cursor, timeZone);
    const end = zonedLocalToUtc(dateYmd, next, timeZone);
    ranges.push({ startMs: start.getTime(), endMs: end.getTime() });
    cursor = next;
  }
  return ranges;
}

export type BlockedTimeRange = {
  startsAt: string;
  endsAt: string;
};

export function deriveAvailabilitySlots(input: {
  settings: AvailabilitySettings;
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  venueId: string;
  venueName: string;
  days?: number;
  fromYmd?: string;
  /** Accepted bookings (or other holds) that remove public/selectable slots. */
  blockedRanges?: BlockedTimeRange[];
}): DerivedSlot[] {
  const timeZone = input.settings.timezone;
  const dayCount = input.days ?? 14;
  const startYmd = input.fromYmd ?? todayYmdInTimeZone(timeZone);
  const unavailable = input.exceptions.filter((e) => e.exception_type === "unavailable");
  const extra = input.exceptions.filter((e) => e.exception_type === "available");
  const blockedRanges = (input.blockedRanges ?? []).map((range) => ({
    startMs: new Date(range.startsAt).getTime(),
    endMs: new Date(range.endsAt).getTime(),
  }));

  const collected = new Map<string, SlotRange>();

  for (let i = 0; i < dayCount; i += 1) {
    const dateYmd = addLocalDays(startYmd, i);
    const windows = generateWindowsForDate(dateYmd, input.rules, timeZone);
    for (const window of windows) {
      for (const slot of slotsFromWindow(
        dateYmd,
        window.startHm,
        window.endHm,
        window.duration,
        timeZone
      )) {
        collected.set(`${slot.startMs}-${slot.endMs}`, slot);
      }
    }
  }

  // Remove slots overlapping unavailable exceptions or accepted bookings.
  for (const [key, slot] of [...collected.entries()]) {
    const blockedByException = unavailable.some((exception) =>
      overlaps(slot, {
        startMs: new Date(exception.starts_at).getTime(),
        endMs: new Date(exception.ends_at).getTime(),
      })
    );
    const blockedByBooking = blockedRanges.some((range) => overlaps(slot, range));
    if (blockedByException || blockedByBooking) collected.delete(key);
  }

  // Add extra availability exception slots.
  for (const exception of extra) {
    const duration = exception.slot_duration_minutes;
    if (!duration) continue;
    const start = new Date(exception.starts_at);
    const end = new Date(exception.ends_at);
    const startY = ymdInTimeZone(start, timeZone);
    const endY = ymdInTimeZone(end, timeZone);
    // Walk local dates covered by the exception.
    let cursorYmd = startY;
    for (let guard = 0; guard < 14; guard += 1) {
      const dayStartHm =
        cursorYmd === startY ? hmInTimeZone(start, timeZone) : "00:00";
      const dayEndHm = cursorYmd === endY ? hmInTimeZone(end, timeZone) : "23:59";
      for (const slot of slotsFromWindow(
        cursorYmd,
        dayStartHm,
        dayEndHm,
        duration,
        timeZone
      )) {
        // Keep only slots fully inside the exception interval.
        if (
          slot.startMs >= start.getTime() &&
          slot.endMs <= end.getTime()
        ) {
          collected.set(`${slot.startMs}-${slot.endMs}`, slot);
        }
      }
      if (cursorYmd === endY) break;
      cursorYmd = addLocalDays(cursorYmd, 1);
    }
  }

  // Remove any remaining slots that overlap accepted bookings (including extras).
  if (blockedRanges.length > 0) {
    for (const [key, slot] of [...collected.entries()]) {
      if (blockedRanges.some((range) => overlaps(slot, range))) {
        collected.delete(key);
      }
    }
  }

  const now = Date.now();
  return [...collected.values()]
    .filter((slot) => slot.startMs >= now)
    .sort((a, b) => a.startMs - b.startMs)
    .map((slot) => ({
      startsAt: new Date(slot.startMs).toISOString(),
      endsAt: new Date(slot.endMs).toISOString(),
      timezone: timeZone,
      venueId: input.venueId,
      venueName: input.venueName,
      coachVenueId: input.settings.coach_venue_id,
    }));
}

export function groupSlotsByLocalDate(
  slots: DerivedSlot[],
  timeZone: string
): Array<{ date: string; label: string; slots: DerivedSlot[] }> {
  const groups = new Map<string, DerivedSlot[]>();
  for (const slot of slots) {
    const date = ymdInTimeZone(slot.startsAt, timeZone);
    const list = groups.get(date) ?? [];
    list.push(slot);
    groups.set(date, list);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, daySlots]) => ({
      date,
      label: new Intl.DateTimeFormat("en-GB", {
        timeZone,
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date(daySlots[0]!.startsAt)),
      slots: daySlots,
    }));
}
