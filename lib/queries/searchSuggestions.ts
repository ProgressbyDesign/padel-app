import { COACH_GOAL_SUGGESTION_EXAMPLES } from "../marketplaceSearch";
import { normalizeSearchKey, rankSearchMatches } from "../searchFuzzy";
import { resolveCoachImageUrl } from "../coachImageResolve";
import { conciseCoachLocationSummary, type CoachWithVenueLinks } from "../coachVenueGeo";
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

export type OutcomeSuggestion = {
  kind: "outcome";
  label: string;
};

export type EntityCoachSuggestion = {
  id: string;
  name: string;
  role: string | null;
  imageUrl: string | null;
  locationSummary: string | null;
};

export type WhereSuggestionsResult = {
  cities: LocationCitySuggestion[];
  countries: LocationCountrySuggestion[];
};

const SUGGESTION_FETCH_CAP = 80;
const VENUE_SUGGEST_SELECT = "id, name, city, country, image_url, search_key";
const VENUE_SUGGEST_SELECT_BASE = "id, name, city, country, image_url";

type VenueSuggestRow = {
  id: string | number;
  name?: string | null;
  city?: string | null;
  country?: string | null;
  image_url?: string | null;
};

function mapVenueSuggestRows(data: VenueSuggestRow[]): EntityVenueSuggestion[] {
  return data.map((v) => ({
    id: String(v.id),
    name: v.name?.trim() || "Venue",
    city: v.city?.trim() ?? null,
    country: v.country?.trim() ?? null,
    imageUrl: typeof v.image_url === "string" && v.image_url.trim() ? v.image_url.trim() : null,
  }));
}

/** Parse "City, Country" or country-only hints from the Where field. */
function parseLocationHint(hint: string): { city?: string; country: string } | null {
  const trimmed = hint.trim();
  if (!trimmed) return null;
  const comma = trimmed.indexOf(",");
  if (comma > 0) {
    const city = trimmed.slice(0, comma).trim();
    const country = trimmed.slice(comma + 1).trim();
    if (city && country) return { city, country };
  }
  return { country: trimmed };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyVenueLocationFilter(query: any, locationHint: string) {
  const parsed = parseLocationHint(locationHint);
  if (!parsed) return query;

  if (parsed.city) {
    return query.ilike("city", `%${parsed.city}%`).ilike("country", `%${parsed.country}%`);
  }

  const countryKey = normalizeSearchKey(parsed.country);
  if (countryKey) {
    return query.or(`country.ilike.%${parsed.country}%,search_key.ilike.%${countryKey}%`);
  }
  return query.ilike("country", `%${parsed.country}%`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyVenueKeywordFilter(query: any, queryText: string) {
  const key = normalizeSearchKey(queryText);
  if (!key) return query;
  return query.ilike("search_key", `%${key}%`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyVenueKeywordFilterFallback(query: any, queryText: string) {
  const term = queryText.trim();
  if (!term) return query;
  const pattern = `%${term}%`;
  return query.or(`name.ilike.${pattern},city.ilike.${pattern},country.ilike.${pattern}`);
}

function isMissingColumnError(message: string, column: string): boolean {
  return message.includes(column) && (message.includes("does not exist") || message.includes("column"));
}

function dedupeCountries(rows: { country?: string | null }[]): LocationCountrySuggestion[] {
  const seen = new Set<string>();
  const out: LocationCountrySuggestion[] = [];
  for (const row of rows) {
    const country = row.country?.trim();
    if (!country) continue;
    const ck = country.toLowerCase();
    if (seen.has(ck)) continue;
    seen.add(ck);
    out.push({ kind: "country", label: country, country });
  }
  out.sort((a, b) => a.label.localeCompare(b.label));
  return out;
}

/** Countries + cities from venues (works for venue and coach search). */
export async function fetchWhereSuggestions(query: string): Promise<WhereSuggestionsResult> {
  const q = query.trim();
  const key = q ? normalizeSearchKey(q) : "";

  const countriesPromise = supabase
    .from("venues")
    .select("country")
    .not("country", "is", null);

  let venueQuery = supabase.from("venues").select("city, country, search_key").limit(SUGGESTION_FETCH_CAP);
  if (key) {
    venueQuery = venueQuery.ilike("search_key", `%${key}%`);
  }

  const [countriesRes, venuesResInitial] = await Promise.all([countriesPromise, venueQuery]);

  let venueRows: { city?: string | null; country?: string | null }[] = [];
  if (venuesResInitial.error && isMissingColumnError(venuesResInitial.error.message, "search_key")) {
    let fallbackQuery = supabase.from("venues").select("city, country").limit(SUGGESTION_FETCH_CAP);
    if (key) {
      fallbackQuery = applyVenueKeywordFilterFallback(fallbackQuery, q);
    }
    const fallbackRes = await fallbackQuery;
    if (!fallbackRes.error) venueRows = fallbackRes.data ?? [];
  } else if (!venuesResInitial.error) {
    venueRows = venuesResInitial.data ?? [];
  }

  let countryRows = dedupeCountries(countriesRes.data ?? []);
  if (key && countryRows.length) {
    countryRows = rankSearchMatches(countryRows, q, (i) => ({ primary: i.label }), 20);
  }

  const citySeen = new Set<string>();
  const cityRows: LocationCitySuggestion[] = [];

  if (venueRows.length) {
    for (const row of venueRows) {
      const country = row.country?.trim();
      const city = row.city?.trim();
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
  }

  const rankLoc = <T extends { label: string }>(items: T[]) =>
    q ? rankSearchMatches(items, q, (i) => ({ primary: i.label }), 12) : items.slice(0, 12);

  return {
    countries: countryRows,
    cities: rankLoc(cityRows),
  };
}

export async function fetchVenueNameSuggestions(
  query: string,
  locationHint?: string
): Promise<EntityVenueSuggestion[]> {
  const q = query.trim();
  const loc = locationHint?.trim() ?? "";

  const buildQuery = (select: string, useSearchKey: boolean) => {
    let dbQuery = supabase.from("venues").select(select).limit(SUGGESTION_FETCH_CAP);

    if (q) {
      dbQuery = useSearchKey ? applyVenueKeywordFilter(dbQuery, q) : applyVenueKeywordFilterFallback(dbQuery, q);
    }
    if (loc) {
      dbQuery = applyVenueLocationFilter(dbQuery, loc);
    }
    if (!q && !loc) {
      dbQuery = dbQuery
        .order("rating", { ascending: false, nullsFirst: false })
        .order("name", { ascending: true });
    }

    return dbQuery;
  };

  let res = await buildQuery(VENUE_SUGGEST_SELECT, true);
  if (res.error && isMissingColumnError(res.error.message, "search_key")) {
    res = await buildQuery(VENUE_SUGGEST_SELECT_BASE, false);
  }

  if (res.error) {
    console.warn("[search] venue suggestions failed:", res.error.message);
    return [];
  }

  if (!res.data?.length) return [];

  const rows = mapVenueSuggestRows(res.data as unknown as VenueSuggestRow[]);

  return q
    ? rankSearchMatches(rows, q, (v) => ({
        primary: v.name,
        secondary: [v.city, v.country].filter(Boolean).join(", "),
      }), 12)
    : rows.slice(0, 12);
}

async function coachIdsInLocationHint(locationHint: string): Promise<string[] | null> {
  const loc = locationHint.trim();
  if (!loc) return null;

  let venueQuery = supabase.from("venues").select("id").limit(100);
  venueQuery = applyVenueLocationFilter(venueQuery, loc);

  let { data: venues, error } = await venueQuery;

  if (error?.message && isMissingColumnError(error.message, "search_key")) {
    const parsed = parseLocationHint(loc);
    if (parsed?.city) {
      venueQuery = supabase
        .from("venues")
        .select("id")
        .ilike("city", `%${parsed.city}%`)
        .ilike("country", `%${parsed.country}%`)
        .limit(100);
    } else if (parsed) {
      venueQuery = supabase.from("venues").select("id").ilike("country", `%${parsed.country}%`).limit(100);
    }
    ({ data: venues, error } = await venueQuery);
  }

  if (error || !venues?.length) return [];

  const { data: links } = await supabase
    .from("coach_venues")
    .select("coach_id")
    .in(
      "venue_id",
      venues.map((v) => v.id)
    );

  return links?.length ? [...new Set(links.map((l) => String(l.coach_id)))] : [];
}

function goalExamplesForQuery(query: string): OutcomeSuggestion[] {
  const q = query.trim();
  const examples = COACH_GOAL_SUGGESTION_EXAMPLES.map((label) => ({ label }));
  const ranked = q
    ? rankSearchMatches(examples, q, (i) => ({ primary: i.label }), 8)
    : examples.slice(0, 6);
  return ranked.map((row) => ({ kind: "outcome" as const, label: row.label }));
}

async function fetchOutcomeSuggestionsFromDb(query: string): Promise<OutcomeSuggestion[]> {
  const q = query.trim();
  if (!q) return [];

  const { data, error } = await supabase
    .from("coach_outcomes")
    .select("outcome")
    .limit(200);

  if (error || !data?.length) return [];

  const seen = new Set<string>();
  const rows: { label: string }[] = [];
  for (const row of data) {
    const label = row.outcome?.trim();
    if (!label) continue;
    const k = label.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    rows.push({ label });
  }

  return rankSearchMatches(rows, q, (i) => ({ primary: i.label }), 8).map((r) => ({
    kind: "outcome" as const,
    label: r.label,
  }));
}

export async function fetchCoachEntitySuggestions(
  query: string,
  locationHint?: string
): Promise<{ outcomes: OutcomeSuggestion[]; coaches: EntityCoachSuggestion[] }> {
  const q = query.trim();
  const key = q ? normalizeSearchKey(q) : "";

  const coachIdsInLocation = locationHint?.trim()
    ? await coachIdsInLocationHint(locationHint)
    : null;

  if (coachIdsInLocation?.length === 0) {
    return { outcomes: goalExamplesForQuery(q), coaches: [] };
  }

  const dbOutcomes = await fetchOutcomeSuggestionsFromDb(q);
  const exampleOutcomes = !key ? goalExamplesForQuery("") : [];
  const outcomeSeen = new Set<string>();
  const outcomes: OutcomeSuggestion[] = [];
  for (const o of [...dbOutcomes, ...exampleOutcomes]) {
    const k = o.label.toLowerCase();
    if (outcomeSeen.has(k)) continue;
    outcomeSeen.add(k);
    outcomes.push(o);
    if (outcomes.length >= 8) break;
  }

  if (!key && !locationHint?.trim()) {
    return { outcomes, coaches: [] };
  }

  let dbQuery = supabase
    .from("coaches")
    .select(
      `
      id,
      name,
      role,
      search_key,
      image_url,
      coach_images ( image_url, is_primary ),
      coach_venues (
        is_primary,
        venues ( city, country )
      )
    `
    )
    .limit(SUGGESTION_FETCH_CAP);

  if (key) {
    dbQuery = dbQuery.ilike("search_key", `%${key}%`);
  }
  if (coachIdsInLocation?.length) {
    dbQuery = dbQuery.in("id", coachIdsInLocation);
  }

  const { data, error } = await dbQuery;
  if (error || !data?.length) {
    return { outcomes, coaches: [] };
  }

  const rows: EntityCoachSuggestion[] = data.map((c) => ({
    id: String(c.id),
    name: c.name?.trim() || "Coach",
    role: c.role?.trim() ?? null,
    imageUrl: resolveCoachImageUrl(
      (c as { coach_images?: { image_url?: string | null; is_primary?: boolean | null }[] }).coach_images,
      c.image_url
    ),
    locationSummary: conciseCoachLocationSummary(c as CoachWithVenueLinks),
  }));

  const coaches = q
    ? rankSearchMatches(rows, q, (c) => ({ primary: c.name, secondary: c.role ?? "" }), 12)
    : rows.slice(0, 12);

  return { outcomes, coaches };
}

/** @deprecated use fetchCoachEntitySuggestions */
export async function fetchCoachNameSuggestions(
  query: string,
  locationHint?: string
): Promise<EntityCoachSuggestion[]> {
  const { coaches } = await fetchCoachEntitySuggestions(query, locationHint);
  return coaches;
}

export type SuggestionsApiPayload = {
  where: WhereSuggestionsResult;
  venues: EntityVenueSuggestion[];
  coaches: EntityCoachSuggestion[];
  outcomes: OutcomeSuggestion[];
};

export async function fetchSearchSuggestions(
  mode: SearchMode,
  field: "where" | "entity",
  query: string,
  locationHint?: string
): Promise<SuggestionsApiPayload> {
  if (field === "where") {
    const where = await fetchWhereSuggestions(query);
    return { where, venues: [], coaches: [], outcomes: [] };
  }

  if (mode === "venues") {
    const venues = await fetchVenueNameSuggestions(query, locationHint);
    return { where: { cities: [], countries: [] }, venues, coaches: [], outcomes: [] };
  }

  const { outcomes, coaches } = await fetchCoachEntitySuggestions(query, locationHint);
  return { where: { cities: [], countries: [] }, venues: [], coaches, outcomes };
}
