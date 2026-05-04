/** Country options for nationality / location dropdowns and destination tags (English labels). */

const FALLBACK: { code: string; label: string }[] = [
  { code: "ES", label: "Spain" },
  { code: "PT", label: "Portugal" },
  { code: "SE", label: "Sweden" },
  { code: "GB", label: "United Kingdom" },
  { code: "FR", label: "France" },
  { code: "DE", label: "Germany" },
  { code: "IT", label: "Italy" },
  { code: "NL", label: "Netherlands" },
  { code: "BE", label: "Belgium" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "US", label: "United States" },
  { code: "MX", label: "Mexico" },
  { code: "AR", label: "Argentina" },
  { code: "BR", label: "Brazil" },
  { code: "NO", label: "Norway" },
  { code: "DK", label: "Denmark" },
  { code: "FI", label: "Finland" },
  { code: "PL", label: "Poland" },
  { code: "IE", label: "Ireland" },
  { code: "CH", label: "Switzerland" },
  { code: "AT", label: "Austria" },
  { code: "AU", label: "Australia" },
  { code: "NZ", label: "New Zealand" },
  { code: "ZA", label: "South Africa" },
  { code: "MA", label: "Morocco" },
].sort((a, b) => a.label.localeCompare(b.label));

let cached: { code: string; label: string }[] | null = null;

export function getCountryOptions(): { code: string; label: string }[] {
  if (cached) return cached;
  try {
    const IntlAny = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
    if (typeof IntlAny.supportedValuesOf === "function") {
      const codes = IntlAny.supportedValuesOf("region").filter(
        (c) => c.length === 2 && !["ZZ", "EU", "UN"].includes(c)
      );
      const dn = new Intl.DisplayNames(["en"], { type: "region" });
      cached = codes
        .map((code) => ({ code, label: dn.of(code) ?? code }))
        .sort((a, b) => a.label.localeCompare(b.label));
      return cached;
    }
  } catch {
    /* use fallback */
  }
  cached = FALLBACK;
  return cached;
}

export function filterCountryLabels(query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return getCountryOptions()
    .map((o) => o.label)
    .filter((label) => label.toLowerCase().includes(q))
    .slice(0, limit);
}
