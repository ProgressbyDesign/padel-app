import type { CoachVenueLinkRow } from "./coachVenueGeo";
import { rankSearchMatches } from "./searchFuzzy";

/** Skill bands for listings / profile badges */
export type CoachSkillLevel = "Beginner" | "Intermediate" | "Advanced" | "Pro";

export type CoachAchievement = {
  title: string;
  description?: string;
  year?: number;
  is_highlight?: boolean;
};

export type Coach = {
  id: string;
  name: string | null;
  role: string | null;
  description: string | null;
  image_url: string | null;
  /** Resolved avatar for PDP / cards (primary coach_images or fallback image_url) */
  image?: string;
  slug?: string | null;
  /** Optional: e.g. skill band (future / extended profile) */
  level?: string | null;
  /** Optional: focus area (future / extended profile) */
  specialty?: string | null;
  rating?: number | string | null;
  review_count?: number | null;
  experience_years?: number | string | null;
  travel_available?: boolean | null;
  email?: string | null;
  phone?: string | null;
  /** Legacy single headline on `coaches` (optional fallback when no rows in coach_outcomes) */
  outcome?: string | null;
  /** Parsed labels from `coach_outcomes` (and optional legacy `outcome`) */
  outcomes?: string[];
  /** Raw embed from Supabase when listing/PDP query joins coach_outcomes */
  coach_outcomes?: { outcome?: string | null }[] | null;
  /** Geography via linked venues (`is_primary` preferred) */
  coach_venues?: CoachVenueLinkRow[] | null;
  coach_images?: { image_url?: string | null; is_primary?: boolean | null }[] | null;
  /** Listing / PDP: who the coach trains (e.g. Adults, Juniors) */
  audience?: string[];
  achievements?: CoachAchievement[];
  price_from?: string | null;
};

/** Minimal coach row for search dropdowns */
export type CoachSearchRow = {
  id: string;
  name: string;
  role: string | null;
};

export type VenueSearchRow = {
  id: string;
  name: string;
};

export function toCoachSearchRows(coaches: Coach[]): CoachSearchRow[] {
  return coaches.map((c) => ({
    id: String(c.id),
    name: c.name?.trim() || "Coach",
    role: c.role?.trim() ?? null,
  }));
}

export function toVenueSearchRows(venues: { id: string | number; name?: string | null }[]): VenueSearchRow[] {
  return venues.map((v) => ({
    id: String(v.id),
    name: v.name?.trim() || "Venue",
  }));
}

export function filterCoachRows(rows: CoachSearchRow[], query: string, limit = 50): CoachSearchRow[] {
  return rankSearchMatches(
    rows,
    query,
    (r) => ({ primary: r.name, secondary: r.role ?? "" }),
    limit
  );
}

export function filterVenueRows(rows: VenueSearchRow[], query: string, limit = 50): VenueSearchRow[] {
  return rankSearchMatches(rows, query, (r) => ({ primary: r.name }), limit);
}

export function capList<T>(arr: T[], max: number): T[] {
  return arr.length <= max ? arr : arr.slice(0, max);
}
