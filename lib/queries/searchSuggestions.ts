import { normalizeSearchKey, rankSearchMatches } from "../searchFuzzy";
import { supabase } from "../supabase";
import type { SearchMode } from "../marketplaceSearch";

export type LocationCitySuggestion = {
  kind: "city";
  label: string;
  city: string;
  country: string;
};

export type LocationCountrySuggestion = {
  kind: "country";
  label: string;
  country: string;
};

export type EntityVenueSuggestion = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  imageUrl: string | null;
};

export type EntityCoachSuggestion = {
  id: string;
  name: string;
  role: string | null;
  imageUrl: string | null;
};

export type WhereSuggestionsResult = {
  cities: LocationCitySuggestion[];
  countries: LocationCountrySuggestion[];
};

const SUGGESTION_FETCH_CAP = 80;

export async function fetchWhereSuggestions(query: string): Promise<WhereSuggestionsResult> {
  const q = query.trim();
  const key = q ? normalizeSearchKey(q) : "";

  let dbQuery = supabase.from("venues").select("city, country, search_key").limit(SUGGESTION_FETCH_CAP);

  if (key) {
    dbQuery = dbQuery.ilike("search_key", `%${key}%`);
  } else {
    dbQuery = dbQuery.not("country", "is", null).order("country", { ascending: true });
  }

  const { data, error } = await dbQuery;
  if (error || !data?.length) {
    return { cities: [], countries: [] };
  }

  const citySeen = new Set<string>();
  const countrySeen = new Set<string>();
  const cityRows: LocationCitySuggestion[] = [];
  const countryRows: LocationCountrySuggestion[] = [];

  for (const row of data) {
    const country = row.country?.trim();
    const city = row.city?.trim();
    if (country) {
      const ck = country.toLowerCase();
      if (!countrySeen.has(ck)) {
        countrySeen.add(ck);
        countryRows.push({ kind: "country", label: country, country });
      }
    }
    if (city && country) {
      const keyCity = `${city.toLowerCase()}\0${country.toLowerCase()}`;
      if (!citySeen.has(keyCity)) {
        citySeen.add(keyCity);
        cityRows.push({
          kind: "city",
          label: `${city}, ${country}`,
          city,
          country,
        });
      }
    }
  }

  const rankLoc = <T extends { label: string }>(items: T[]) =>
    q ? rankSearchMatches(items, q, (i) => ({ primary: i.label }), 12) : items.slice(0, 12);

  return {
    cities: rankLoc(cityRows),
    countries: rankLoc(countryRows),
  };
}

export async function fetchVenueNameSuggestions(
  query: string,
  locationHint?: string
): Promise<EntityVenueSuggestion[]> {
  const q = query.trim();
  const key = q ? normalizeSearchKey(q) : "";
  if (!key && !locationHint?.trim()) return [];

  let dbQuery = supabase
    .from("venues")
    .select("id, name, city, country, search_key, main_image, image_url")
    .limit(SUGGESTION_FETCH_CAP);

  if (key) {
    dbQuery = dbQuery.ilike("search_key", `%${key}%`);
  }

  const locKey = locationHint?.trim() ? normalizeSearchKey(locationHint) : "";
  if (locKey) {
    dbQuery = dbQuery.ilike("search_key", `%${locKey}%`);
  }

  const { data, error } = await dbQuery;
  if (error || !data?.length) return [];

  const rows: EntityVenueSuggestion[] = data.map((v) => ({
    id: String(v.id),
    name: v.name?.trim() || "Venue",
    city: v.city?.trim() ?? null,
    country: v.country?.trim() ?? null,
    imageUrl:
      (typeof v.main_image === "string" && v.main_image.trim()) ||
      (typeof v.image_url === "string" && v.image_url.trim()) ||
      null,
  }));

  return q
    ? rankSearchMatches(rows, q, (v) => ({
        primary: v.name,
        secondary: [v.city, v.country].filter(Boolean).join(", "),
      }), 12)
    : rows.slice(0, 12);
}

export async function fetchCoachNameSuggestions(
  query: string,
  locationHint?: string
): Promise<EntityCoachSuggestion[]> {
  const q = query.trim();
  const key = q ? normalizeSearchKey(q) : "";

  let coachIdsInLocation: string[] | null = null;
  if (locationHint?.trim()) {
    const locKey = normalizeSearchKey(locationHint);
    if (locKey) {
      const { data: venues } = await supabase
        .from("venues")
        .select("id")
        .ilike("search_key", `%${locKey}%`)
        .limit(100);
      if (venues?.length) {
        const { data: links } = await supabase
          .from("coach_venues")
          .select("coach_id")
          .in(
            "venue_id",
            venues.map((v) => v.id)
          );
        coachIdsInLocation = links?.length
          ? [...new Set(links.map((l) => String(l.coach_id)))]
          : [];
      } else {
        coachIdsInLocation = [];
      }
    }
  }

  if (coachIdsInLocation?.length === 0) return [];

  let dbQuery = supabase
    .from("coaches")
    .select("id, name, role, search_key, image_url")
    .limit(SUGGESTION_FETCH_CAP);

  if (key) {
    dbQuery = dbQuery.ilike("search_key", `%${key}%`);
  }
  if (coachIdsInLocation?.length) {
    dbQuery = dbQuery.in("id", coachIdsInLocation);
  }

  const { data, error } = await dbQuery;
  if (error || !data?.length) return [];

  const rows: EntityCoachSuggestion[] = data.map((c) => ({
    id: String(c.id),
    name: c.name?.trim() || "Coach",
    role: c.role?.trim() ?? null,
    imageUrl: typeof c.image_url === "string" && c.image_url.trim() ? c.image_url.trim() : null,
  }));

  return q
    ? rankSearchMatches(rows, q, (c) => ({ primary: c.name, secondary: c.role ?? "" }), 12)
    : rows.slice(0, 12);
}

export type SuggestionsApiPayload = {
  where: WhereSuggestionsResult;
  venues: EntityVenueSuggestion[];
  coaches: EntityCoachSuggestion[];
};

export async function fetchSearchSuggestions(
  mode: SearchMode,
  field: "where" | "entity",
  query: string,
  locationHint?: string
): Promise<SuggestionsApiPayload> {
  if (field === "where") {
    const where = await fetchWhereSuggestions(query);
    return { where, venues: [], coaches: [] };
  }

  if (mode === "venues") {
    const venues = await fetchVenueNameSuggestions(query, locationHint);
    return { where: { cities: [], countries: [] }, venues, coaches: [] };
  }

  const coaches = await fetchCoachNameSuggestions(query, locationHint);
  return { where: { cities: [], countries: [] }, venues: [], coaches };
}
