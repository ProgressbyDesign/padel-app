export type HomeStatVenueRow = {
  courts: number | string | null;
  city: string | null;
  country: string | null;
};

export function parseCourtCount(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function sumKnownCourts(rows: Pick<HomeStatVenueRow, "courts">[]): number {
  return rows.reduce((sum, row) => sum + parseCourtCount(row.courts), 0);
}

export function destinationKey(
  city: string | null | undefined,
  country: string | null | undefined
): string | null {
  const cityPart = city?.trim().toLowerCase() ?? "";
  const countryPart = country?.trim().toLowerCase() ?? "";
  if (cityPart && countryPart) return `${cityPart}|${countryPart}`;
  if (countryPart) return countryPart;
  if (cityPart) return cityPart;
  return null;
}

export function countUniqueDestinations(
  rows: Pick<HomeStatVenueRow, "city" | "country">[]
): number {
  const keys = new Set<string>();
  for (const row of rows) {
    const key = destinationKey(row.city, row.country);
    if (key) keys.add(key);
  }
  return keys.size;
}
