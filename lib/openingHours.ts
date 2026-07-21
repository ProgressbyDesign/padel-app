export const WEEKDAYS = [
  { key: "monday", label: "Monday", shortLabel: "Mon" },
  { key: "tuesday", label: "Tuesday", shortLabel: "Tue" },
  { key: "wednesday", label: "Wednesday", shortLabel: "Wed" },
  { key: "thursday", label: "Thursday", shortLabel: "Thu" },
  { key: "friday", label: "Friday", shortLabel: "Fri" },
  { key: "saturday", label: "Saturday", shortLabel: "Sat" },
  { key: "sunday", label: "Sunday", shortLabel: "Sun" },
] as const;

export const OPENING_HOURS_STATUSES = [
  "open",
  "closed",
  "open_24_hours",
] as const;

export type WeekdayKey = (typeof WEEKDAYS)[number]["key"];
export type OpeningHoursStatus = (typeof OPENING_HOURS_STATUSES)[number];

export type StructuredDayHours = {
  status: OpeningHoursStatus;
  opens: string | null;
  closes: string | null;
};

export type StructuredOpeningHours = Record<WeekdayKey, StructuredDayHours>;

export type StructuredOpeningHoursResult =
  | { ok: true; value: StructuredOpeningHours }
  | { ok: false; error: string };

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DAY_KEYS = WEEKDAYS.map((day) => day.key);
const DAY_VALUE_KEYS = ["status", "opens", "closes"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[]
): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === expected.length &&
    keys.every((key) => expected.includes(key))
  );
}

function isOpeningHoursStatus(value: unknown): value is OpeningHoursStatus {
  return (
    typeof value === "string" &&
    (OPENING_HOURS_STATUSES as readonly string[]).includes(value)
  );
}

export function validateStructuredOpeningHours(
  input: unknown
): StructuredOpeningHoursResult {
  if (!isRecord(input) || !hasExactKeys(input, DAY_KEYS)) {
    return {
      ok: false,
      error: "Opening hours must contain exactly Monday through Sunday.",
    };
  }

  const output = {} as StructuredOpeningHours;

  for (const { key, label } of WEEKDAYS) {
    const day = input[key];
    if (!isRecord(day) || !hasExactKeys(day, DAY_VALUE_KEYS)) {
      return {
        ok: false,
        error: `${label} has an invalid opening-hours structure.`,
      };
    }

    if (!isOpeningHoursStatus(day.status)) {
      return { ok: false, error: `Choose a valid status for ${label}.` };
    }

    if (day.status === "open") {
      if (
        typeof day.opens !== "string" ||
        typeof day.closes !== "string" ||
        !TIME_PATTERN.test(day.opens) ||
        !TIME_PATTERN.test(day.closes)
      ) {
        return {
          ok: false,
          error: `${label} requires valid opening and closing times.`,
        };
      }
      output[key] = {
        status: "open",
        opens: day.opens,
        closes: day.closes,
      };
      continue;
    }

    if (day.opens !== null || day.closes !== null) {
      return {
        ok: false,
        error: `${label} must not include times when closed or open 24 hours.`,
      };
    }

    output[key] = {
      status: day.status,
      opens: null,
      closes: null,
    };
  }

  return { ok: true, value: output };
}

export function parseStructuredOpeningHoursJson(
  raw: string
): StructuredOpeningHoursResult {
  if (!raw.trim()) {
    return {
      ok: false,
      error: "Set structured opening hours for all seven days.",
    };
  }

  try {
    return validateStructuredOpeningHours(JSON.parse(raw) as unknown);
  } catch {
    return { ok: false, error: "Opening hours contain malformed JSON." };
  }
}

export function getStructuredOpeningHours(
  value: unknown
): StructuredOpeningHours | null {
  const parsed =
    typeof value === "string"
      ? parseStructuredOpeningHoursJson(value)
      : validateStructuredOpeningHours(value);
  return parsed.ok ? parsed.value : null;
}

function legacyDayKey(value: string): WeekdayKey | null {
  const normalized = value.trim().toLowerCase().replace(/\.$/, "");
  const match = WEEKDAYS.find(
    ({ key, label, shortLabel }) =>
      normalized === key ||
      normalized === label.toLowerCase() ||
      normalized === shortLabel.toLowerCase()
  );
  return match?.key ?? null;
}

function legacyTime(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  const twentyFourHour = normalized.match(/^(\d{1,2}):([0-5]\d)$/);
  if (twentyFourHour) {
    const hour = Number(twentyFourHour[1]);
    if (hour > 23) return null;
    return `${String(hour).padStart(2, "0")}:${twentyFourHour[2]}`;
  }

  const twelveHour = normalized.match(/^(\d{1,2}):([0-5]\d)\s*(AM|PM)$/);
  if (!twelveHour) return null;
  const sourceHour = Number(twelveHour[1]);
  if (sourceHour < 1 || sourceHour > 12) return null;
  const hour =
    (sourceHour % 12) + (twelveHour[3] === "PM" ? 12 : 0);
  return `${String(hour).padStart(2, "0")}:${twelveHour[2]}`;
}

function legacyDayHours(value: string): StructuredDayHours | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "closed") {
    return { status: "closed", opens: null, closes: null };
  }
  if (
    normalized === "open 24 hours" ||
    normalized === "open 24 hrs" ||
    normalized === "24 hours"
  ) {
    return { status: "open_24_hours", opens: null, closes: null };
  }

  const range = value.match(/^(.+?)\s*[–—-]\s*(.+)$/);
  if (!range) return null;
  const opens = legacyTime(range[1]);
  const closes = legacyTime(range[2]);
  if (!opens || !closes) return null;
  return { status: "open", opens, closes };
}

export function parseLegacyOpeningHours(
  raw: string | null | undefined
): StructuredOpeningHours | null {
  if (!raw?.trim()) return null;
  const segments = raw
    .split(/[|\n;]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length !== WEEKDAYS.length) return null;

  const output = {} as StructuredOpeningHours;
  for (const segment of segments) {
    const colon = segment.indexOf(":");
    if (colon === -1) return null;
    const key = legacyDayKey(segment.slice(0, colon));
    const hours = legacyDayHours(segment.slice(colon + 1));
    if (!key || !hours || output[key]) return null;
    output[key] = hours;
  }

  return validateStructuredOpeningHours(output).ok ? output : null;
}

function displayHours(day: StructuredDayHours): string {
  if (day.status === "closed") return "Closed";
  if (day.status === "open_24_hours") return "Open 24 hours";
  return `${day.opens}–${day.closes}`;
}

export type StructuredOpeningHoursDisplayRow = {
  label: string;
  hours: string;
};

export function structuredOpeningHoursDisplayRows(
  hours: StructuredOpeningHours
): StructuredOpeningHoursDisplayRow[] {
  const groups: Array<{
    start: number;
    end: number;
    hours: string;
  }> = [];

  WEEKDAYS.forEach(({ key }, index) => {
    const value = displayHours(hours[key]);
    const previous = groups[groups.length - 1];
    if (previous && previous.hours === value && previous.end === index - 1) {
      previous.end = index;
    } else {
      groups.push({ start: index, end: index, hours: value });
    }
  });

  return groups.map((group) => ({
    label:
      group.start === group.end
        ? WEEKDAYS[group.start].shortLabel
        : `${WEEKDAYS[group.start].shortLabel}–${
            WEEKDAYS[group.end].shortLabel
          }`,
    hours: group.hours,
  }));
}
