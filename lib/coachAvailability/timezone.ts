import { SUGGESTED_TIMEZONES } from "@/lib/coachAvailability/constants";

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIanaTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function listSearchableTimeZones(query = ""): string[] {
  const supported =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [...SUGGESTED_TIMEZONES];

  const q = query.trim().toLowerCase();
  const suggested = SUGGESTED_TIMEZONES.filter(
    (zone) => !q || zone.toLowerCase().includes(q)
  );
  const rest = supported.filter(
    (zone) =>
      !SUGGESTED_TIMEZONES.includes(zone as (typeof SUGGESTED_TIMEZONES)[number]) &&
      (!q || zone.toLowerCase().includes(q))
  );
  return [...suggested, ...rest].slice(0, 40);
}

export function isValidTimeHm(value: string): boolean {
  return TIME_PATTERN.test(value);
}

export function isValidDateYmd(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function normalizeTimeHm(value: string): string {
  // Postgres time may arrive as HH:mm:ss
  const trimmed = value.trim();
  if (/^\d{2}:\d{2}:\d{2}/.test(trimmed)) return trimmed.slice(0, 5);
  return trimmed;
}

function partsInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const bag: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  return bag;
}

/** Convert a local calendar date + HH:mm in `timeZone` to a UTC Date. */
export function zonedLocalToUtc(
  dateYmd: string,
  timeHm: string,
  timeZone: string
): Date {
  if (!isValidDateYmd(dateYmd) || !isValidTimeHm(timeHm)) {
    throw new Error("Invalid date or time.");
  }
  if (!isValidIanaTimeZone(timeZone)) {
    throw new Error("Invalid timezone.");
  }

  const [year, month, day] = dateYmd.split("-").map(Number);
  const [hour, minute] = timeHm.split(":").map(Number);

  // Initial guess as UTC, then correct by observed timezone offset.
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i += 1) {
    const parts = partsInTimeZone(new Date(utc), timeZone);
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
    utc += desired - asUtc;
  }
  return new Date(utc);
}

export function formatInTimeZone(
  date: Date | string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions
): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone }).format(value);
}

export function ymdInTimeZone(date: Date | string, timeZone: string): string {
  const parts = partsInTimeZone(
    typeof date === "string" ? new Date(date) : date,
    timeZone
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function hmInTimeZone(date: Date | string, timeZone: string): string {
  const parts = partsInTimeZone(
    typeof date === "string" ? new Date(date) : date,
    timeZone
  );
  return `${parts.hour}:${parts.minute}`;
}

/** ISO weekday 1=Mon … 7=Sun in the given timezone for a local calendar date. */
export function isoWeekdayForLocalDate(
  dateYmd: string,
  timeZone: string
): number {
  const noon = zonedLocalToUtc(dateYmd, "12:00", timeZone);
  const weekday = partsInTimeZone(noon, timeZone).weekday;
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return map[weekday] ?? 1;
}

export function addLocalDays(dateYmd: string, days: number): string {
  const [y, m, d] = dateYmd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function todayYmdInTimeZone(timeZone: string): string {
  return ymdInTimeZone(new Date(), timeZone);
}

export function timeZoneAbbreviation(timeZone: string, at = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    timeZoneName: "short",
  }).formatToParts(at);
  return parts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;
}

export function compareHm(a: string, b: string): number {
  return normalizeTimeHm(a).localeCompare(normalizeTimeHm(b));
}

export function minutesBetweenHm(start: string, end: string): number {
  const [sh, sm] = normalizeTimeHm(start).split(":").map(Number);
  const [eh, em] = normalizeTimeHm(end).split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

export function addMinutesToHm(start: string, minutes: number): string {
  const [h, m] = normalizeTimeHm(start).split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
