export type Coach = {
  id: string;
  name: string | null;
  role: string | null;
  description: string | null;
  image_url: string | null;
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
