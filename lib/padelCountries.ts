export type PadelCountry = {
  name: string;
  slug: string;
  lat: number;
  lng: number;
  href: string;
  code?: string;
};

export function padelCountryHref(countryName: string): string {
  return `/coaches?location=${encodeURIComponent(countryName.trim())}`;
}

export function slugifyCountryName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const COUNTRY_COORD_FALLBACK: Record<string, { lat: number; lng: number; code?: string }> = {
  spain: { lat: 40.4168, lng: -3.7038, code: "ES" },
  italy: { lat: 41.9028, lng: 12.4964, code: "IT" },
  sweden: { lat: 59.3293, lng: 18.0686, code: "SE" },
  france: { lat: 48.8566, lng: 2.3522, code: "FR" },
  portugal: { lat: 38.7223, lng: -9.1393, code: "PT" },
  netherlands: { lat: 52.3676, lng: 4.9041, code: "NL" },
  "united-kingdom": { lat: 51.5074, lng: -0.1278, code: "UK" },
  germany: { lat: 52.52, lng: 13.405, code: "DE" },
  belgium: { lat: 50.8503, lng: 4.3517, code: "BE" },
  "united-arab-emirates": { lat: 25.2048, lng: 55.2708, code: "AE" },
};

/** Preferred display order for the globe country nav. */
export const COUNTRY_NAV_ORDER: string[] = [
  "spain",
  "portugal",
  "italy",
  "united-kingdom",
  "belgium",
  "france",
  "sweden",
  "netherlands",
  "germany",
  "united-arab-emirates",
];

export function sortCountriesForNav(countries: PadelCountry[]): PadelCountry[] {
  const order = new Map(COUNTRY_NAV_ORDER.map((slug, i) => [slug, i]));
  return [...countries].sort((a, b) => {
    const ai = order.get(a.slug) ?? 999;
    const bi = order.get(b.slug) ?? 999;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });
}

export function defaultActiveCountrySlug(countries: PadelCountry[]): string {
  return countries.find((c) => c.slug === "spain")?.slug ?? countries[0]?.slug ?? "";
}

export function countryCode(name: string, slug: string): string {
  const fb = COUNTRY_COORD_FALLBACK[slug];
  if (fb?.code) return fb.code;
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function countryNavLabel(country: PadelCountry): string {
  if (country.slug === "united-kingdom") return "UK";
  if (country.slug === "united-arab-emirates") return "UAE";
  return country.name;
}