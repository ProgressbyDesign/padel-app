import type {
  AvailabilityException,
  AvailabilityRule,
  AvailabilitySettings,
  DerivedSlot,
} from "@/lib/coachAvailability/types";
import { resolveSlotPrice } from "@/lib/coachAvailability/pricing";
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

type SlotRange = {
  startMs: number;
  endMs: number;
  durationMinutes: number;
  fromException: boolean;
  ruleId: string | null;
  exceptionId: string | null;
  ruleOverrideMinor: number | null;
  exceptionOverrideMinor: number | null;
};

function overlaps(
  a: { startMs: number; endMs: number },
  b: { startMs: number; endMs: number }
): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

function generateWindowsForDate(
  dateYmd: string,
  rules: AvailabilityRule[],
  timeZone: string
): Array<{
  startHm: string;
  endHm: string;
  duration: number;
  ruleId: string;
  ruleOverrideMinor: number | null;
}> {
  const weekday = isoWeekdayForLocalDate(dateYmd, timeZone);
  const windows: Array<{
    startHm: string;
    endHm: string;
    duration: number;
    ruleId: string;
    ruleOverrideMinor: number | null;
  }> = [];

  for (const rule of rules) {
    if (!rule.is_active) continue;
    if (rule.day_of_week !== weekday) continue;
    if (rule.valid_from > dateYmd) continue;
    if (rule.valid_until && rule.valid_until < dateYmd) continue;
    windows.push({
      startHm: normalizeTimeHm(rule.start_time),
      endHm: normalizeTimeHm(rule.end_time),
      duration: rule.slot_duration_minutes,
      ruleId: rule.id,
      ruleOverrideMinor: rule.price_override_minor,
    });
  }

  return windows;
}

function slotsFromWindow(
  dateYmd: string,
  startHm: string,
  endHm: string,
  duration: number,
  timeZone: string,
  meta: {
    fromException: boolean;
    ruleId: string | null;
    exceptionId: string | null;
    ruleOverrideMinor: number | null;
    exceptionOverrideMinor: number | null;
  }
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
    ranges.push({
      startMs: start.getTime(),
      endMs: end.getTime(),
      durationMinutes: duration,
      ...meta,
    });
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
  blockedRanges?: BlockedTimeRange[];
}): DerivedSlot[] {
  const timeZone = input.settings.timezone;
  const dayCount = input.days ?? 14;
  const startYmd = input.fromYmd ?? todayYmdInTimeZone(timeZone);
  const unavailable = input.exceptions.filter(
    (e) => e.exception_type === "unavailable"
  );
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
        timeZone,
        {
          fromException: false,
          ruleId: window.ruleId,
          exceptionId: null,
          ruleOverrideMinor: window.ruleOverrideMinor,
          exceptionOverrideMinor: null,
        }
      )) {
        collected.set(`${slot.startMs}-${slot.endMs}`, slot);
      }
    }
  }

  for (const [key, slot] of [...collected.entries()]) {
    const blockedByException = unavailable.some((exception) =>
      overlaps(slot, {
        startMs: new Date(exception.starts_at).getTime(),
        endMs: new Date(exception.ends_at).getTime(),
      })
    );
    const blockedByBooking = blockedRanges.some((range) =>
      overlaps(slot, range)
    );
    if (blockedByException || blockedByBooking) collected.delete(key);
  }

  for (const exception of extra) {
    const duration = exception.slot_duration_minutes;
    if (!duration) continue;
    const start = new Date(exception.starts_at);
    const end = new Date(exception.ends_at);
    const startY = ymdInTimeZone(start, timeZone);
    const endY = ymdInTimeZone(end, timeZone);
    let cursorYmd = startY;
    for (let guard = 0; guard < 14; guard += 1) {
      const dayStartHm =
        cursorYmd === startY ? hmInTimeZone(start, timeZone) : "00:00";
      const dayEndHm =
        cursorYmd === endY ? hmInTimeZone(end, timeZone) : "23:59";
      for (const slot of slotsFromWindow(
        cursorYmd,
        dayStartHm,
        dayEndHm,
        duration,
        timeZone,
        {
          fromException: true,
          ruleId: null,
          exceptionId: exception.id,
          ruleOverrideMinor: null,
          exceptionOverrideMinor: exception.price_override_minor,
        }
      )) {
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
    .map((slot) => {
      const price = resolveSlotPrice({
        durationMinutes: slot.durationMinutes,
        currency: input.settings.currency,
        defaultHourlyRateMinor: input.settings.default_hourly_rate_minor,
        ruleOverrideMinor: slot.ruleOverrideMinor,
        exceptionOverrideMinor: slot.exceptionOverrideMinor,
        fromException: slot.fromException,
      });
      return {
        startsAt: new Date(slot.startMs).toISOString(),
        endsAt: new Date(slot.endMs).toISOString(),
        timezone: timeZone,
        venueId: input.venueId,
        venueName: input.venueName,
        coachVenueId: input.settings.coach_venue_id,
        priceAmountMinor: price.priceAmountMinor,
        currency: price.currency,
        pricingSource: price.pricingSource,
        fromException: slot.fromException,
        ruleId: slot.ruleId,
        exceptionId: slot.exceptionId,
      };
    });
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
