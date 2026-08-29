import type { Coach, CoachSkillLevel } from "./coaches";
import { coachOutcomeLabel } from "./coachManagement";
import { formatCoachLocationLabel } from "./coachLocations";
import { optionLabel, PLAYER_LEVELS } from "./coachProfileApplication/constants";
import type { CoachPdpQueryRow } from "./coachProfileView";
import { rawCoachRowToProfileView } from "./coachProfileView";
import {
  listingLocationFromCoachRow,
  pickPrimaryVenueFromCoachRow,
  venueCoordPair,
} from "./coachVenueGeo";
import { searchMatchScore } from "./searchFuzzy";

/** Listing row — map to API / Supabase when ready */
export type CoachListingItem = {
  id: string;
  name: string;
  avatarImage: string | null;
  rating: number;
  reviewCount: number | null;
  level: CoachSkillLevel;
  /** Structured player level labels when available */
  playerLevels?: string[];
  locationCity: string;
  locationCountry: string;
  /** URL slug for `/coaches/[city]` (lowercase, hyphenated) */
  citySlug: string;
  experienceYears: number;
  audience: ("Adults" | "Juniors")[];
  travelAvailable: boolean;
  outcomes: string;
  outcomeTags?: string[];
  primaryOutcome?: string | null;
  priceFrom: string | null;
  /** Primary linked venue coordinates (for distance sorting) */
  locationLat?: number | string | null;
  locationLng?: number | string | null;
  /** Miles from user; set by addDistancesToCoaches */
  distance?: number;
  /** When false, listing can offer a claim affordance */
  isClaimed?: boolean;
};

export type CoachListingFilters = {
  locationQuery: string;
  level: "all" | CoachSkillLevel;
  audienceAdults: boolean;
  audienceJuniors: boolean;
  travelOnly: boolean;
};

/** Badge count for filters modal (excludes location — handled by search bar). */
export function countCoachModalFiltersActive(
  f: Pick<CoachListingFilters, "level" | "audienceAdults" | "audienceJuniors" | "travelOnly">
): number {
  let n = 0;
  if (f.level !== "all") n += 1;
  if (f.audienceAdults) n += 1;
  if (f.audienceJuniors) n += 1;
  if (f.travelOnly) n += 1;
  return n;
}

export type CoachListingSort = "recommended" | "rating" | "experience" | "distance";

/** Coaches shown initially and per “Load more” on PLP. */
export const COACH_LIST_PAGE_SIZE = 50;

const LEVEL_ORDER: Record<CoachSkillLevel, number> = {
  Beginner: 0,
  Intermediate: 1,
  Advanced: 2,
  Pro: 3,
};

export function slugifyCity(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function displayCityFromSlug(slug: string): string {
  if (!slug.trim()) return "";
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Prefill location search from `/coaches/[city]` slug */
export function initialLocationQueryForCitySlug(items: CoachListingItem[], slug: string): string {
  const s = slug.trim().toLowerCase();
  const match = items.find((c) => c.citySlug === s);
  if (match) return match.locationCity;
  return displayCityFromSlug(slug);
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Stable pseudo-random 0..1 from string (for “recommended” tie-break) */
function hash01(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

export function recommendedScore(c: CoachListingItem): number {
  return (
    c.rating * 18 +
    c.experienceYears * 1.2 +
    (c.travelAvailable ? 3 : 0) +
    LEVEL_ORDER[c.level] * 0.5 +
    hash01(c.id) * 0.01
  );
}

export function filterCoachListing(items: CoachListingItem[], filters: CoachListingFilters): CoachListingItem[] {
  const q = norm(filters.locationQuery);
  const wantAdults = filters.audienceAdults;
  const wantJuniors = filters.audienceJuniors;
  const audienceActive = wantAdults || wantJuniors;

  return items.filter((c) => {
    if (filters.level !== "all" && c.level !== filters.level) return false;
    if (filters.travelOnly && !c.travelAvailable) return false;

    if (audienceActive) {
      const okAdult = wantAdults && c.audience.includes("Adults");
      const okJunior = wantJuniors && c.audience.includes("Juniors");
      if (!okAdult && !okJunior) return false;
    }

    if (q) {
      const locScore = searchMatchScore(
        filters.locationQuery,
        c.locationCity,
        c.locationCountry
      );
      const nameScore = searchMatchScore(filters.locationQuery, c.name);
      if (Math.max(locScore, nameScore) <= 0) return false;
    }

    return true;
  });
}

function distanceRank(d: number | undefined): number {
  return typeof d === "number" && Number.isFinite(d) ? d : Infinity;
}

export function sortCoachListing(items: CoachListingItem[], sort: CoachListingSort): CoachListingItem[] {
  const copy = [...items];
  if (sort === "rating") {
    copy.sort((a, b) => b.rating - a.rating || (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
  } else if (sort === "experience") {
    copy.sort((a, b) => b.experienceYears - a.experienceYears || b.rating - a.rating);
  } else if (sort === "distance") {
    copy.sort((a, b) => {
      const da = distanceRank(a.distance);
      const db = distanceRank(b.distance);
      if (da !== db) return da - db;
      return recommendedScore(b) - recommendedScore(a);
    });
  } else {
    copy.sort((a, b) => recommendedScore(b) - recommendedScore(a));
  }
  return copy;
}

export function getCoachListingCitySlugs(items: CoachListingItem[]): string[] {
  return [...new Set(items.map((c) => c.citySlug))].sort();
}

/** Cities to suggest when the current filter returns nothing */
export function suggestCitiesForEmptyState(
  all: CoachListingItem[],
  opts?: { preferredCountry?: string | null }
): { label: string; slug: string; count: number }[] {
  const bySlug = new Map<string, { label: string; slug: string; count: number; country: string }>();
  for (const c of all) {
    const slug = c.citySlug;
    const cur = bySlug.get(slug);
    if (cur) cur.count += 1;
    else
      bySlug.set(slug, {
        label: c.locationCity,
        slug,
        count: 1,
        country: c.locationCountry,
      });
  }
  let rows = [...bySlug.values()];
  if (opts?.preferredCountry) {
    const pc = norm(opts.preferredCountry);
    const same = rows.filter((r) => norm(r.country) === pc);
    if (same.length) rows = same;
  }
  rows.sort((a, b) => b.count - a.count);
  return rows.slice(0, 6).map(({ label, slug, count }) => ({ label, slug, count }));
}

/**
 * Mock dataset — replace with `fetch` / Supabase in the page or a server loader.
 * Images: remote URLs (e.g. Unsplash) or your CDN; swap when wiring Supabase.
 */
/** PLP fallback rows — IDs are not in Supabase; do not link to `/coach/[id]`. */
export const MOCK_COACH_LISTING: CoachListingItem[] = [
  {
    id: "mock-coach-1",
    name: "Elena Vázquez",
    avatarImage:
      "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80&auto=format&fit=crop",
    rating: 4.95,
    reviewCount: 62,
    level: "Pro",
    locationCity: "Madrid",
    locationCountry: "Spain",
    citySlug: "madrid",
    experienceYears: 12,
    audience: ["Adults", "Juniors"],
    travelAvailable: true,
    outcomes: "Match tactics",
    outcomeTags: ["Match tactics"],
    primaryOutcome: "Match tactics",
    priceFrom: "€55 / session",
  },
  {
    id: "mock-coach-2",
    name: "James O'Neill",
    avatarImage: null,
    rating: 4.8,
    reviewCount: 34,
    level: "Advanced",
    locationCity: "London",
    locationCountry: "United Kingdom",
    citySlug: "london",
    experienceYears: 8,
    audience: ["Adults"],
    travelAvailable: true,
    outcomes: "Bandeja & match play",
    outcomeTags: ["Bandeja & match play"],
    primaryOutcome: "Bandeja & match play",
    priceFrom: "£48 / session",
  },
  {
    id: "mock-coach-3",
    name: "Sofia Martín",
    avatarImage:
      "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80&auto=format&fit=crop",
    rating: 4.9,
    reviewCount: 51,
    level: "Advanced",
    locationCity: "Barcelona",
    locationCountry: "Spain",
    citySlug: "barcelona",
    experienceYears: 9,
    audience: ["Adults", "Juniors"],
    travelAvailable: false,
    outcomes: "Technical foundations and confident net play.",
    priceFrom: "€45 / session",
  },
  {
    id: "mock-coach-4",
    name: "Marc Dubois",
    avatarImage: null,
    rating: 4.7,
    reviewCount: 28,
    level: "Intermediate",
    locationCity: "Paris",
    locationCountry: "France",
    citySlug: "paris",
    experienceYears: 5,
    audience: ["Adults"],
    travelAvailable: true,
    outcomes: "Smart positioning and doubles communication.",
    priceFrom: "€40 / session",
  },
  {
    id: "mock-coach-5",
    name: "Ana Costa",
    avatarImage:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80&auto=format&fit=crop",
    rating: 4.85,
    reviewCount: 41,
    level: "Pro",
    locationCity: "Lisbon",
    locationCountry: "Portugal",
    citySlug: "lisbon",
    experienceYears: 11,
    audience: ["Adults"],
    travelAvailable: true,
    outcomes: "Aggressive serving and transition to the net.",
    priceFrom: "€50 / session",
  },
  {
    id: "mock-coach-6",
    name: "Tom Weber",
    avatarImage: null,
    rating: 4.6,
    reviewCount: 19,
    level: "Beginner",
    locationCity: "Berlin",
    locationCountry: "Germany",
    citySlug: "berlin",
    experienceYears: 3,
    audience: ["Adults", "Juniors"],
    travelAvailable: false,
    outcomes: "Fun intro sessions — grips, wall drills, and first matches.",
    priceFrom: "€35 / session",
  },
  {
    id: "mock-coach-7",
    name: "Laura Kim",
    avatarImage:
      "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80&auto=format&fit=crop",
    rating: 4.92,
    reviewCount: 73,
    level: "Advanced",
    locationCity: "London",
    locationCountry: "United Kingdom",
    citySlug: "london",
    experienceYears: 10,
    audience: ["Juniors"],
    travelAvailable: false,
    outcomes: "Junior pathways: athleticism, discipline, and tournament prep.",
    priceFrom: "£52 / session",
  },
  {
    id: "mock-coach-8",
    name: "Diego Ríos",
    avatarImage: null,
    rating: 4.75,
    reviewCount: 22,
    level: "Intermediate",
    locationCity: "Madrid",
    locationCountry: "Spain",
    citySlug: "madrid",
    experienceYears: 6,
    audience: ["Adults"],
    travelAvailable: true,
    outcomes: "Consistent lobs, exits from the glass, and defensive structure.",
    priceFrom: "€42 / session",
  },
  {
    id: "mock-coach-9",
    name: "Mia Johansson",
    avatarImage:
      "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80&auto=format&fit=crop",
    rating: 4.88,
    reviewCount: 36,
    level: "Pro",
    locationCity: "Stockholm",
    locationCountry: "Sweden",
    citySlug: "stockholm",
    experienceYears: 14,
    audience: ["Adults"],
    travelAvailable: true,
    outcomes: "Elite footwork and reading the game one step earlier.",
    priceFrom: "520 SEK / session",
  },
  {
    id: "mock-coach-10",
    name: "Chris Palmer",
    avatarImage: null,
    rating: 4.55,
    reviewCount: 14,
    level: "Beginner",
    locationCity: "London",
    locationCountry: "United Kingdom",
    citySlug: "london",
    experienceYears: 2,
    audience: ["Adults", "Juniors"],
    travelAvailable: false,
    outcomes: "Build confidence from zero — rules, safety, and social play.",
    priceFrom: "£38 / session",
  },
  {
    id: "mock-coach-11",
    name: "Valentina Rossi",
    avatarImage:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80&auto=format&fit=crop",
    rating: 4.83,
    reviewCount: 47,
    level: "Advanced",
    locationCity: "Rome",
    locationCountry: "Italy",
    citySlug: "rome",
    experienceYears: 7,
    audience: ["Adults"],
    travelAvailable: true,
    outcomes: "Volleys that stick and calm decision-making under stress.",
    priceFrom: "€46 / session",
  },
  {
    id: "mock-coach-12",
    name: "Nina Hoffmann",
    avatarImage: null,
    rating: 4.78,
    reviewCount: 31,
    level: "Intermediate",
    locationCity: "Amsterdam",
    locationCountry: "Netherlands",
    citySlug: "amsterdam",
    experienceYears: 4,
    audience: ["Adults", "Juniors"],
    travelAvailable: true,
    outcomes: "Rhythm and patience — build rallies before attacking.",
    priceFrom: "€39 / session",
  },
];

/** Future: swap for API call */
export async function fetchCoachListing(): Promise<CoachListingItem[]> {
  return MOCK_COACH_LISTING;
}

function parseListingRating(n: unknown): number {
  if (typeof n === "number" && Number.isFinite(n)) return n;
  if (typeof n === "string" && n.trim()) {
    const x = Number(n);
    if (Number.isFinite(x)) return x;
  }
  return 0;
}

function parseListingReviewCount(n: unknown): number | null {
  if (typeof n === "number" && n > 0) return n;
  if (typeof n === "string" && n.trim()) {
    const x = Number(n);
    if (Number.isFinite(x) && x > 0) return x;
  }
  return null;
}

function parseListingSkillLevel(raw?: string | null): CoachSkillLevel {
  const s = raw?.trim();
  if (s === "Beginner" || s === "Intermediate" || s === "Advanced" || s === "Pro") return s;
  const l = s?.toLowerCase() ?? "";
  if (l.includes("beginner")) return "Beginner";
  if (l.includes("pro") || l.includes("competitive")) return "Pro";
  if (l.includes("advanced")) return "Advanced";
  if (l.includes("intermediate")) return "Intermediate";
  return "Intermediate";
}

/** Prefer structured player_levels; soft-fallback to legacy coaches.level. */
export function skillLevelFromPlayerLevels(
  playerLevels: string[] | null | undefined,
  legacyLevel?: string | null
): CoachSkillLevel {
  const values = (playerLevels ?? []).map((v) => v.trim().toLowerCase()).filter(Boolean);
  if (values.some((v) => v === "competitive_professional" || v.includes("pro"))) return "Pro";
  if (values.some((v) => v === "advanced" || v.includes("advanced"))) return "Advanced";
  if (values.some((v) => v === "intermediate" || v.includes("intermediate"))) return "Intermediate";
  if (values.some((v) => v === "beginner" || v.includes("beginner"))) return "Beginner";
  return parseListingSkillLevel(legacyLevel);
}

export function playerLevelValueForSkillFilter(level: CoachSkillLevel): string {
  if (level === "Pro") return "competitive_professional";
  return level.toLowerCase();
}

function formatListingPriceFrom(raw: Coach["price_from"]): string | null {
  return raw == null ? null : String(raw).trim() || null;
}

function extractOutcomeLines(row: Coach, profile: ReturnType<typeof rawCoachRowToProfileView>): string[] {
  const embeds = row.coach_outcomes ?? [];
  const fromStructured = embeds
    .map((o) => {
      const key = (o as { outcome_key?: string | null }).outcome_key?.trim();
      const label = o.outcome?.trim();
      if (key) return coachOutcomeLabel(key);
      if (label) return coachOutcomeLabel(label);
      return null;
    })
    .filter((s): s is string => Boolean(s));
  if (fromStructured.length > 0) return [...new Set(fromStructured)];
  return profile.outcomes.length > 0 ? profile.outcomes : [];
}

function listingLocationFromStructured(
  row: Coach
): { city: string; country: string } | null {
  const locations = (
    row as Coach & {
      coach_locations?: Array<{
        city?: string | null;
        country?: string | null;
        is_primary?: boolean | null;
      }> | null;
    }
  ).coach_locations;
  if (!locations?.length) return null;
  const primary =
    locations.find((loc) => loc.is_primary) ?? locations[0] ?? null;
  if (!primary) return null;
  const city = primary.city?.trim() || "";
  const country = primary.country?.trim() || "";
  if (!city && !country) return null;
  return { city: city || formatCoachLocationLabel({ city, country }), country };
}

function extractPlayerLevelLabels(row: Coach): string[] {
  const attrs = (
    row as Coach & {
      coach_attributes?:
        | { player_levels?: string[] | null }
        | Array<{ player_levels?: string[] | null }>
        | null;
    }
  ).coach_attributes;
  const raw = Array.isArray(attrs) ? attrs[0]?.player_levels : attrs?.player_levels;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return [...new Set(raw.map((value) => optionLabel(PLAYER_LEVELS, String(value))))];
}

function parseListingAudience(raw: unknown): ("Adults" | "Juniors")[] {
  if (Array.isArray(raw)) {
    const out: ("Adults" | "Juniors")[] = [];
    for (const x of raw) {
      const s = String(x).toLowerCase();
      if (s.includes("adult")) out.push("Adults");
      if (s.includes("junior")) out.push("Juniors");
    }
    return out.length > 0 ? [...new Set(out)] : ["Adults"];
  }
  return ["Adults"];
}

/** Map Supabase `coaches` row (+ `coach_venues` / `venues`) to PLP item. */
export function coachRowToListingItem(row: Coach): CoachListingItem | null {
  const profile = rawCoachRowToProfileView(row as unknown as CoachPdpQueryRow);
  const id = profile.id.trim();
  if (!id) return null;

  const primaryVenue = pickPrimaryVenueFromCoachRow(row);
  const structuredLocation = listingLocationFromStructured(row);
  const venueLocation = listingLocationFromCoachRow(row);
  const cityLabel =
    structuredLocation?.city ||
    (venueLocation.city !== "Location not confirmed" ? venueLocation.city : "") ||
    profile.location.city ||
    "Location not confirmed";
  const countryLabel =
    structuredLocation?.country || venueLocation.country || profile.location.country || "";
  const coords = venueCoordPair(primaryVenue);
  const name = profile.name?.trim() || "Coach";

  const audienceLabels = profile.audience.filter(
    (x): x is "Adults" | "Juniors" => x === "Adults" || x === "Juniors"
  );
  const audience =
    audienceLabels.length > 0 ? audienceLabels : parseListingAudience(row.audience);

  const playerLevelLabels =
    profile.playerLevels.length > 0 ? profile.playerLevels : extractPlayerLevelLabels(row);
  const rawPlayerLevelValues = (() => {
    const attrs = (
      row as Coach & {
        coach_attributes?:
          | { player_levels?: string[] | null }
          | Array<{ player_levels?: string[] | null }>
          | null;
      }
    ).coach_attributes;
    const raw = Array.isArray(attrs) ? attrs[0]?.player_levels : attrs?.player_levels;
    return Array.isArray(raw) ? raw.map(String) : [];
  })();
  const level = skillLevelFromPlayerLevels(rawPlayerLevelValues, profile.level ?? row.role);

  const outcomeLines = extractOutcomeLines(row, profile);
  const primaryOutcome = outcomeLines[0] || profile.primaryOutcome || null;

  return {
    id,
    name,
    avatarImage: profile.image,
    rating: parseListingRating(profile.rating.score),
    reviewCount: parseListingReviewCount(profile.rating.count),
    level,
    playerLevels: playerLevelLabels,
    locationCity: cityLabel,
    locationCountry: countryLabel,
    citySlug: slugifyCity(cityLabel || "unknown"),
    experienceYears: profile.experienceYears,
    audience,
    travelAvailable: profile.travel === true,
    outcomes: primaryOutcome ?? "",
    outcomeTags:
      outcomeLines.length > 0
        ? outcomeLines.slice(0, 3)
        : primaryOutcome
          ? [primaryOutcome]
          : [],
    primaryOutcome,
    priceFrom: formatListingPriceFrom(profile.pricing.from),
    locationLat: coords.lat,
    locationLng: coords.lng,
    isClaimed: Boolean(
      (row as Coach & { is_claimed?: boolean | null }).is_claimed
    ),
  };
}

/** Listing cores are selected from coach_public_profiles via PUBLIC_COACH_SELECT. */
export { PUBLIC_COACH_SELECT as COACH_LISTING_SELECT } from "./publicProfiles";

export function coachesRowsToListingItems(rows: Coach[]): CoachListingItem[] {
  return rows.map(coachRowToListingItem).filter((x): x is CoachListingItem => x != null);
}

/** Target for coach cards: real DB ids open PDP; mock PLP rows stay on the listing. */
export function coachListingProfileHref(
  coachId: string,
  from: "coaches" | "venues" = "coaches"
): string {
  if (coachId.startsWith("mock-coach-")) return "/coaches";
  const base = `/coach/${encodeURIComponent(coachId)}`;
  const q = from === "venues" ? "from=venues" : "from=coaches";
  return `${base}?${q}`;
}
