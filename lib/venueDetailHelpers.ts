import type { Venue } from "./venueFilters";

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
        .split(/\n|;/)
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
      return [o.weekday_text.trim()];
    }
  }
  return null;
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
  if (venue.coaching_available) bits.push("coaching on site");

  if (!place && bits.length === 0) return null;

  const detail = bits.length ? ` Highlights: ${bits.join(" · ")}.` : "";
  return `${name}${place ? ` in ${place}` : ""} is set up for padel training.${detail} Check courts, coaching, and reviews to see if it fits your sessions.`
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
