import type { Coach, CoachSkillLevel } from "./coaches";
import type { CoachPdpQueryRow } from "./coachProfileView";
import { rawCoachRowToProfileView } from "./coachProfileView";
import { supabase } from "./supabase.js";
import type { Venue } from "./venueFilters";

/** Listing row — map to API / Supabase when ready */
export type CoachListingItem = {
  id: string;
  name: string;
  avatarImage: string | null;
  rating: number;
  reviewCount: number | null;
  level: CoachSkillLevel;
  locationCity: string;
  locationCountry: string;
  /** URL slug for `/coaches/[city]` (lowercase, hyphenated) */
  citySlug: string;
  experienceYears: number;
  audience: ("Adults" | "Juniors")[];
  travelAvailable: boolean;
  outcomes: string;
  priceFrom: string | null;
  /** Supabase `location_lat` / `location_lng` for distance sorting */
  locationLat?: number | string | null;
  locationLng?: number | string | null;
  /** Miles from user; set by addDistancesToCoaches */
  distance?: number;
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

export const COACH_LIST_PAGE_SIZE = 9;

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
      const city = norm(c.locationCity);
      const country = norm(c.locationCountry);
      const hay = `${city} ${country}`;
      if (!hay.includes(q) && !city.startsWith(q) && !country.startsWith(q)) return false;
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
    outcomes: "Match tactics, bandeja, and pressure play at a high level.",
    priceFrom: "From €55 / session",
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
    outcomes: "Improve your bandeja and match play with structured drills.",
    priceFrom: "From £48 / session",
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
    priceFrom: "From €45 / session",
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
    priceFrom: "From €40 / session",
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
    priceFrom: "From €50 / session",
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
    priceFrom: "From €35 / session",
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
    priceFrom: "From £52 / session",
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
    priceFrom: "From €42 / session",
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
    priceFrom: "From 520 SEK / session",
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
    priceFrom: "From £38 / session",
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
    priceFrom: "From €46 / session",
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
    priceFrom: "From €39 / session",
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
  if (l.includes("pro")) return "Pro";
  if (l.includes("advanced")) return "Advanced";
  if (l.includes("intermediate")) return "Intermediate";
  return "Intermediate";
}

function shortOutcomeLine(text: string, max = 72): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function formatListingPriceFrom(raw: Coach["price_from"]): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const t = raw.trim();
    return t.length > 0 ? t : null;
  }
  return String(raw).trim() || null;
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

/** Map Supabase `coaches` row to PLP item (uses `location_lat` / `location_lng` for distance). */
export function coachRowToListingItem(row: Coach): CoachListingItem | null {
  const profile = rawCoachRowToProfileView(row as unknown as CoachPdpQueryRow);
  const id = profile.id.trim();
  if (!id) return null;

  const city = profile.location.city?.trim() || (row.city ?? "").trim() || "Unknown";
  const country = profile.location.country?.trim() || (row.country ?? "").trim() || "—";
  const name = profile.name?.trim() || "Coach";

  const audienceLabels = profile.audience.filter((x): x is "Adults" | "Juniors" => x === "Adults" || x === "Juniors");
  const audience =
    audienceLabels.length > 0 ? audienceLabels : parseListingAudience(row.audience);

  const rawOutcomeLine =
    profile.outcomes[0] ||
    profile.primaryOutcome ||
    profile.description?.trim() ||
    row.specialty?.trim() ||
    "Padel coaching tailored to your game.";

  return {
    id,
    name,
    avatarImage: profile.image,
    rating: parseListingRating(profile.rating.score),
    reviewCount: parseListingReviewCount(profile.rating.count),
    level: parseListingSkillLevel(profile.level ?? row.role),
    locationCity: city,
    locationCountry: country,
    citySlug: slugifyCity(city),
    experienceYears: profile.experienceYears,
    audience,
    travelAvailable: profile.travel === true,
    outcomes: shortOutcomeLine(rawOutcomeLine),
    priceFrom: formatListingPriceFrom(profile.pricing.from),
    locationLat: row.location_lat,
    locationLng: row.location_lng,
  };
}

export function coachesRowsToListingItems(rows: Coach[]): CoachListingItem[] {
  return rows.map(coachRowToListingItem).filter((x): x is CoachListingItem => x != null);
}

/** Target for coach cards: real DB ids open PDP; mock PLP rows stay on the listing. */
export function coachListingProfileHref(coachId: string): string {
  if (coachId.startsWith("mock-coach-")) return "/coaches";
  return `/coach/${encodeURIComponent(coachId)}`;
}

/** Server: venues + coach listing + raw coach rows for PLP / SEO routes */
export async function loadCoachesExplorerData(): Promise<{
  venues: Venue[];
  coaches: CoachListingItem[];
  coachEntities: Coach[];
}> {
  const [venuesRes, coachesRes] = await Promise.all([
    supabase.from("venues").select("*").limit(100),
    supabase
      .from("coaches")
      .select(
        `
        *,
        coach_outcomes (
          outcome
        ),
        coach_attributes (
          audience_adults,
          audience_juniors
        )
      `
      )
      .limit(200),
  ]);

  const venues = (venuesRes.data ?? []) as Venue[];

  let coachRows = !coachesRes.error && coachesRes.data?.length ? (coachesRes.data as Coach[]) : null;
  if (!coachRows && coachesRes.error) {
    const fallback = await supabase.from("coaches").select("*").limit(200);
    if (!fallback.error && fallback.data?.length) {
      coachRows = fallback.data as Coach[];
    }
  }

  const coachEntities = (coachRows ?? []) as Coach[];

  const coaches =
    coachEntities.length > 0 ? coachesRowsToListingItems(coachEntities) : MOCK_COACH_LISTING;

  return { venues, coaches, coachEntities };
}
