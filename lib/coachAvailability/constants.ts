export const AVAILABILITY_DAYS = [
  { dayOfWeek: 1, key: "monday", label: "Monday", shortLabel: "Mon" },
  { dayOfWeek: 2, key: "tuesday", label: "Tuesday", shortLabel: "Tue" },
  { dayOfWeek: 3, key: "wednesday", label: "Wednesday", shortLabel: "Wed" },
  { dayOfWeek: 4, key: "thursday", label: "Thursday", shortLabel: "Thu" },
  { dayOfWeek: 5, key: "friday", label: "Friday", shortLabel: "Fri" },
  { dayOfWeek: 6, key: "saturday", label: "Saturday", shortLabel: "Sat" },
  { dayOfWeek: 7, key: "sunday", label: "Sunday", shortLabel: "Sun" },
] as const;

export type AvailabilityDayKey = (typeof AVAILABILITY_DAYS)[number]["key"];

export const SLOT_DURATION_OPTIONS = [30, 45, 60, 75, 90, 120] as const;

export const MIN_SLOT_DURATION = 15;
export const MAX_SLOT_DURATION = 240;
export const SLOT_DURATION_STEP = 15;

export const SUGGESTED_TIMEZONES = [
  "Europe/London",
  "Europe/Dublin",
  "Europe/Madrid",
  "Europe/Paris",
  "Europe/Rome",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Brussels",
  "Europe/Lisbon",
  "Europe/Stockholm",
  "Europe/Warsaw",
  "Europe/Vienna",
  "Europe/Zurich",
  "Asia/Dubai",
  "America/New_York",
  "America/Los_Angeles",
] as const;

export const EXCEPTION_TYPES = ["unavailable", "available"] as const;
export type AvailabilityExceptionType = (typeof EXCEPTION_TYPES)[number];

export const COUNTRY_TIMEZONE_HINTS: Record<string, string> = {
  "United Kingdom": "Europe/London",
  UK: "Europe/London",
  Spain: "Europe/Madrid",
  France: "Europe/Paris",
  Italy: "Europe/Rome",
  Germany: "Europe/Berlin",
  Portugal: "Europe/Lisbon",
  Netherlands: "Europe/Amsterdam",
  Belgium: "Europe/Brussels",
  Sweden: "Europe/Stockholm",
  Poland: "Europe/Warsaw",
  Austria: "Europe/Vienna",
  Switzerland: "Europe/Zurich",
  Ireland: "Europe/Dublin",
  UAE: "Asia/Dubai",
  "United Arab Emirates": "Asia/Dubai",
};

export function isValidSlotDuration(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= MIN_SLOT_DURATION &&
    value <= MAX_SLOT_DURATION &&
    value % SLOT_DURATION_STEP === 0
  );
}

export function dayLabel(dayOfWeek: number): string {
  return (
    AVAILABILITY_DAYS.find((day) => day.dayOfWeek === dayOfWeek)?.label ??
    `Day ${dayOfWeek}`
  );
}
