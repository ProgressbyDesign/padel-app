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
  /** Supabase geography for distance (primary source for coach PLP distance) */
  location_lat?: number | string | null;
  location_lng?: number | string | null;
  city?: string | null;
  country?: string | null;
  location_city?: string | null;
  location_country?: string | null;
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

function includesNorm(hay: string, needle: string) {
  return hay.toLowerCase().includes(needle);
}

export function filterCoachRows(rows: CoachSearchRow[], queryLower: string): CoachSearchRow[] {
  if (!queryLower) return rows;
  return rows.filter(
    (r) => includesNorm(r.name, queryLower) || (r.role && includesNorm(r.role, queryLower))
  );
}

export function filterVenueRows(rows: VenueSearchRow[], queryLower: string): VenueSearchRow[] {
  if (!queryLower) return rows;
  return rows.filter((r) => includesNorm(r.name, queryLower));
}

export function capList<T>(arr: T[], max: number): T[] {
  return arr.length <= max ? arr : arr.slice(0, max);
}
