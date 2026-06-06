import {
  COUNTRY_COORD_FALLBACK,
  countryCode,
  padelCountryHref,
  slugifyCountryName,
  type PadelCountry,
} from "../padelCountries";
import { supabase } from "../supabase";

type VenueGeoRow = {
  country: string | null;
  lat?: number | null;
  lng?: number | null;
};

function parseCoord(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function fetchPadelCountries(): Promise<PadelCountry[]> {
  const { data, error } = await supabase
    .from("venues")
    .select("country, lat, lng")
    .not("country", "is", null)
    .limit(3000);

  if (error) {
    console.warn("[padelCountries] venue fetch failed:", error.message);
    return fallbackCountriesFromConfig();
  }

  const groups = new Map<string, { name: string; lats: number[]; lngs: number[] }>();

  for (const row of (data ?? []) as VenueGeoRow[]) {
    const name = row.country?.trim();
    if (!name) continue;
    const slug = slugifyCountryName(name);
    const lat = parseCoord(row.lat);
    const lng = parseCoord(row.lng);
    const g = groups.get(slug) ?? { name, lats: [], lngs: [] };
    if (lat != null) g.lats.push(lat);
    if (lng != null) g.lngs.push(lng);
    groups.set(slug, g);
  }

  if (groups.size === 0) return fallbackCountriesFromConfig();

  const countries: PadelCountry[] = [];

  for (const [slug, g] of groups) {
    const fb = COUNTRY_COORD_FALLBACK[slug];
    const lat =
      g.lats.length > 0 ? g.lats.reduce((a, b) => a + b, 0) / g.lats.length : (fb?.lat ?? 0);
    const lng =
      g.lngs.length > 0 ? g.lngs.reduce((a, b) => a + b, 0) / g.lngs.length : (fb?.lng ?? 0);
    if (!fb && g.lats.length === 0) continue;

    countries.push({
      name: g.name,
      slug,
      lat,
      lng,
      href: padelCountryHref(g.name),
      code: countryCode(g.name, slug),
    });
  }

  countries.sort((a, b) => a.name.localeCompare(b.name));
  return countries.length > 0 ? countries : fallbackCountriesFromConfig();
}

function fallbackCountriesFromConfig(): PadelCountry[] {
  const names: Record<string, string> = {
    spain: "Spain",
    italy: "Italy",
    sweden: "Sweden",
    france: "France",
    portugal: "Portugal",
    netherlands: "Netherlands",
    "united-kingdom": "United Kingdom",
    germany: "Germany",
    belgium: "Belgium",
    "united-arab-emirates": "United Arab Emirates",
  };

  return Object.entries(COUNTRY_COORD_FALLBACK).map(([slug, coords]) => {
    const name = names[slug] ?? slug;
    return {
      name,
      slug,
      lat: coords.lat,
      lng: coords.lng,
      href: padelCountryHref(name),
      code: coords.code ?? countryCode(name, slug),
    };
  });
}