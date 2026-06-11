import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import { normalizeSearchKey } from "./searchFuzzy";

/** Parse "City, Country" or country-only hints from the Where field. */
export function parseLocationHint(hint: string): { city?: string; country: string } | null {
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

/** Apply location filter using city/country columns (not the combined search_key). */
export function applyVenueLocationFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: PostgrestFilterBuilder<any, any, any, any, any>,
  locationHint: string
) {
  const parsed = parseLocationHint(locationHint);
  if (!parsed) return query;

  if (parsed.city) {
    return query.ilike("city", `%${parsed.city}%`).ilike("country", `%${parsed.country}%`);
  }

  return query.ilike("country", `%${parsed.country}%`);
}

/** Match venue name via display name and normalized search_key (accent-tolerant key). */
export function applyVenueNameFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: PostgrestFilterBuilder<any, any, any, any, any>,
  nameQuery: string
) {
  const term = nameQuery.trim();
  if (!term) return query;

  const key = normalizeSearchKey(term);
  const pattern = `%${term}%`;

  if (key) {
    return query.or(`name.ilike.${pattern},search_key.ilike.%${key}%`);
  }

  return query.ilike("name", pattern);
}