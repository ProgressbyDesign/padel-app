import type { Venue } from "./venueFilters";
import { sortVenueImages } from "./venueImages";

function managedVenueImageUrls(venue: Venue): string[] {
  return sortVenueImages(venue.venue_images ?? [])
    .map((image) => image.url.trim())
    .filter(Boolean);
}

/** Resolved hero URL: managed primary/first → legacy image_url → legacy fallbacks. */
export function getVenueMainImageUrl(venue: Venue): string | null {
  const managed = managedVenueImageUrls(venue);
  const legacyGallery = Array.isArray(venue.images)
    ? venue.images.map((value) => String(value).trim()).find(Boolean)
    : null;
  return (
    managed[0] ||
    venue.image_url?.trim() ||
    venue.main_image?.trim() ||
    legacyGallery ||
    null
  );
}

/** Managed gallery first, then de-duplicated legacy image fields. */
export function normalizeGalleryImages(venue: Venue): string[] {
  const managed = managedVenueImageUrls(venue);
  if (managed.length > 0) return [...new Set(managed)];

  const raw = venue.images;
  const urls = [
    venue.image_url?.trim(),
    ...(Array.isArray(raw)
      ? raw.map((x) =>
          typeof x === "string" ? x.trim() : String(x).trim()
        )
      : []),
    venue.main_image?.trim(),
  ].filter((value): value is string => Boolean(value));
  return [...new Set(urls)];
}

export function formatRatingValue(raw: Venue["rating"]): string | null {
  const n = typeof raw === "string" ? Number(raw) : raw;
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  return n.toFixed(1);
}

export function getSurfaceLabel(raw?: string | null): string {
  if (!raw) return "Not specified";
  const value = raw.toLowerCase();
  if (value.includes("indoor")) return "Indoor";
  if (value.includes("outdoor")) return "Outdoor";
  return raw;
}

export function venueExperienceLabel(venue_type?: string | null): string | null {
  const v = venue_type?.toLowerCase();
  if (v === "premium_training") return "Premium training";
  if (v === "casual") return "Casual play";
  if (v === "resort") return "Resort";
  return null;
}

export function normalizeWebsiteUrl(url: string): string | null {
  const t = url.trim();
  if (!t) return null;
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  return `https://${t}`;
}

/** Coerce DB lat/lng which may be number or string */
export function getCoordinates(venue: Venue): { lat: number; lng: number } | null {
  const lat = typeof venue.lat === "number" ? venue.lat : venue.lat != null ? Number(venue.lat) : NaN;
  const lng = typeof venue.lng === "number" ? venue.lng : venue.lng != null ? Number(venue.lng) : NaN;
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

export function formatOpeningHoursLines(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return null;
    try {
      return formatOpeningHoursLines(JSON.parse(s));
    } catch {
      const lines = s
        .split(/\n|;|\|/)
        .map((x) => x.trim())
        .filter(Boolean);
      return lines.length ? lines : null;
    }
  }
  if (Array.isArray(raw)) {
    const lines = raw.map((x) => String(x).trim()).filter(Boolean);
    return lines.length ? lines : null;
  }
  if (typeof raw === "object" && raw !== null) {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.weekday_text)) {
      const lines = o.weekday_text.map((x) => String(x).trim()).filter(Boolean);
      return lines.length ? lines : null;
    }
    if (typeof o.weekday_text === "string" && o.weekday_text.trim()) {
      return formatOpeningHoursLines(o.weekday_text);
    }
  }
  return null;
}

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type OpeningHoursByDay = {
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
};

const DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const satisfies readonly (keyof OpeningHoursByDay)[];

function normalizeDayKey(dayPart: string): (typeof DAY_KEYS)[number] | null {
  const d = dayPart.toLowerCase().replace(/\./g, "").trim();
  const map: Record<string, (typeof DAY_KEYS)[number]> = {
    monday: "monday",
    mon: "monday",
    tuesday: "tuesday",
    tue: "tuesday",
    wednesday: "wednesday",
    wed: "wednesday",
    thursday: "thursday",
    thu: "thursday",
    thur: "thursday",
    thurs: "thursday",
    friday: "friday",
    fri: "friday",
    saturday: "saturday",
    sat: "saturday",
    sunday: "sunday",
    sun: "sunday",
  };
  return map[d] ?? null;
}

function parseDayHoursSegment(segment: string): { key: (typeof DAY_KEYS)[number]; hours: string } | null {
  const colon = segment.indexOf(":");
  if (colon === -1) return null;
  const dayPart = segment.slice(0, colon).trim();
  const hours = segment.slice(colon + 1).trim();
  if (!hours) return null;
  const key = normalizeDayKey(dayPart);
  if (!key) return null;
  return { key, hours };
}

function mergeOpeningHoursSegment(
  out: OpeningHoursByDay,
  key: (typeof DAY_KEYS)[number],
  hours: string
): boolean {
  const existing = out[key];
  if (existing !== undefined && existing !== hours) return false;
  out[key] = hours;
  return true;
}

/**
 * Parse a pipe-separated opening hours string from Supabase, e.g.
 * `"Monday: 9:00 AM – 10:30 PM | Tuesday: …"`.
 */
export function parseOpeningHours(opening_hours: string): OpeningHoursByDay | null {
  const segments = opening_hours
    .trim()
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);
  if (segments.length === 0) return null;

  const out: OpeningHoursByDay = {};
  for (const seg of segments) {
    const parsed = parseDayHoursSegment(seg);
    if (!parsed) return null;
    if (!mergeOpeningHoursSegment(out, parsed.key, parsed.hours)) return null;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Build a day map from lines like `"Monday: 9:00 AM – 5:00 PM"` (e.g. after splitting on `|`, `\n`, or `;`). */
function openingHoursRecordFromLines(lines: string[]): OpeningHoursByDay | null {
  const out: OpeningHoursByDay = {};
  for (const line of lines) {
    const parsed = parseDayHoursSegment(line.trim());
    if (!parsed) return null;
    if (!mergeOpeningHoursSegment(out, parsed.key, parsed.hours)) return null;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export type OpeningHoursGroupedRow = { label: string; hours: string };

/**
 * Group consecutive calendar days that share the same hours (e.g. Mon–Fri, Sat, Sun).
 * Labels use short day names and an en dash for ranges.
 */
export function groupOpeningHours(parsed: OpeningHoursByDay): OpeningHoursGroupedRow[] {
  const items: { index: number; hours: string }[] = [];
  DAY_KEYS.forEach((key, index) => {
    const h = parsed[key];
    if (h !== undefined) items.push({ index, hours: h });
  });
  if (items.length === 0) return [];

  const groups: { startIdx: number; endIdx: number; hours: string }[] = [];
  for (const it of items) {
    const last = groups[groups.length - 1];
    if (last && last.hours === it.hours && last.endIdx === it.index - 1) {
      last.endIdx = it.index;
    } else {
      groups.push({ startIdx: it.index, endIdx: it.index, hours: it.hours });
    }
  }

  return groups.map((g) => {
    const label =
      g.startIdx === g.endIdx
        ? WEEKDAY_SHORT[g.startIdx]
        : `${WEEKDAY_SHORT[g.startIdx]}–${WEEKDAY_SHORT[g.endIdx]}`;
    return { label, hours: g.hours };
  });
}

export type VenueOpeningHoursUi =
  | { kind: "grouped"; rows: OpeningHoursGroupedRow[] }
  | { kind: "fallback"; text: string }
  | { kind: "unavailable" };

/**
 * Resolve DB `opening_hours` (string, JSON, or `weekday_text` shape) into UI-ready data.
 */
export function getVenueOpeningHoursUi(raw: unknown): VenueOpeningHoursUi | null {
  if (raw == null) return null;
  if (typeof raw === "string" && raw.trim() === "") return null;

  const lines = formatOpeningHoursLines(raw);

  let record: OpeningHoursByDay | null = null;
  if (typeof raw === "string" && raw.trim()) {
    record = parseOpeningHours(raw.trim());
  }
  if (!record && lines?.length) {
    record = openingHoursRecordFromLines(lines);
  }

  if (record && Object.keys(record).length > 0) {
    const rows = groupOpeningHours(record);
    if (rows.length > 0) return { kind: "grouped", rows };
  }

  if (lines?.length) {
    return { kind: "fallback", text: lines.join(" · ") };
  }

  if (typeof raw === "string") {
    return { kind: "fallback", text: raw.trim() };
  }

  return { kind: "unavailable" };
}

/** Group parsed weekday lines (e.g. Google `weekday_text`) into Mon–Fri / Sat–Sun style rows. */
export function groupOpeningHoursForDisplay(lines: string[]): { label: string; value: string }[] {
  const record = openingHoursRecordFromLines(lines);
  if (!record) return lines.map((l) => ({ label: "", value: l }));
  return groupOpeningHours(record).map((row) => ({ label: row.label, value: row.hours }));
}

/**
 * Context for a future “open now” check (timezone + time-range parsing).
 * Call sites can build this from `parseOpeningHours` once those pieces exist.
 */
export type OpeningHoursOpenNowContext = {
  byDay: OpeningHoursByDay;
  /** IANA time zone for the venue when known */
  timeZone?: string;
};

/** Placeholder until opening ranges and venue timezone are wired up. */
export function isVenueOpenNow(_context: OpeningHoursOpenNowContext, _now: Date = new Date()): boolean {
  void _context;
  void _now;
  return false;
}

/**
 * Prefer AI `description`, then coaching copy, then a short composed line for training context.
 */
export function getVenueDescriptionForPdp(venue: Venue): string | null {
  const primary = venue.description?.trim();
  if (primary) return primary;
  const secondary = venue.coaching_description?.trim();
  if (secondary) return secondary;

  const place = [venue.city, venue.country].filter(Boolean).join(", ");
  const name = venue.name?.trim() || "This venue";
  const bits: string[] = [];
  if (typeof venue.courts === "number") bits.push(`${venue.courts} court${venue.courts === 1 ? "" : "s"}`);
  const surface = getSurfaceLabel(venue.court_type);
  if (surface !== "Not specified") bits.push(surface.toLowerCase());

  if (!place && bits.length === 0) return null;

  const detail = bits.length ? ` Highlights: ${bits.join(" · ")}.` : "";
  return `${name}${place ? ` in ${place}` : ""} is set up for padel training.${detail} Use the details below to see if it fits your sessions.`
    .replace(/\s+/g, " ")
    .trim();
}

export function pickSimilarVenues(venue: Venue, candidates: Venue[], limit = 4): Venue[] {
  const id = String(venue.id);
  const others = candidates.filter((v) => String(v.id) !== id);
  const scored = others.map((v) => {
    let score = 0;
    if (venue.city && v.city === venue.city) score += 3;
    if (venue.country && v.country === venue.country) score += 1;
    return { v, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.v);
}
