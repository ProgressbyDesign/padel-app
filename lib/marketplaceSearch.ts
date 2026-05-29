/** Marketplace discovery search — modes, URL builders, shared types */

export type SearchMode = "venues" | "coaches";

export type MarketplaceSearchValues = {
  mode: SearchMode;
  location: string;
  /** Coach name or venue name */
  entity: string;
};

export function searchModeLabel(mode: SearchMode): string {
  return mode === "venues" ? "Venues" : "Coaches";
}

export function entityFieldLabel(mode: SearchMode): string {
  return mode === "venues" ? "Venue" : "Coach";
}

export function entityPlaceholder(mode: SearchMode): string {
  return mode === "venues" ? "Venue name" : "Coach name";
}

export function listingPath(mode: SearchMode): string {
  return mode === "venues" ? "/venues" : "/coaches";
}

/** Headline supporting copy shown alongside the selected mode. */
export function modeTagline(mode: SearchMode, count: number | null): string {
  if (mode === "venues") {
    return count != null
      ? `${count}+ first-class venues for you`
      : "First-class venues for you";
  }
  return count != null
    ? `We’re proud to promote ${count} coaches`
    : "Hand-picked coaches ready to help";
}

/** Helper copy for the option rows inside the mode dropdown. */
export function modeOptionHelper(mode: SearchMode, count: number | null): string {
  if (mode === "venues") {
    return count != null ? `${count}+ places to play padel` : "Places to play padel";
  }
  return count != null ? `${count} coaches ready to help` : "Coaches ready to help";
}

/** Compact count badge copy (mobile cards + selector trigger). */
export function modeCountLabel(mode: SearchMode, count: number | null): string {
  if (mode === "venues") {
    return count != null ? `${count}+ venues` : "Venues";
  }
  return count != null ? `${count} coaches` : "Coaches";
}

/** URL-safe slug for coach/venue params (readable, shareable). */
export function toSearchParamSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Prefer original label when slug is lossy; used for display only. */
export function fromSearchParamSlug(slug: string): string {
  if (!slug.trim()) return "";
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function buildVenuesSearchUrl(
  values: MarketplaceSearchValues,
  extra?: Record<string, string>
): string {
  const q = new URLSearchParams();
  const loc = values.location.trim();
  const venue = values.entity.trim();
  if (loc) q.set("location", loc);
  if (venue) q.set("venue", toSearchParamSlug(venue) || venue);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v) q.set(k, v);
    }
  }
  const qs = q.toString();
  return qs ? `/venues?${qs}` : "/venues";
}

export function buildCoachesSearchUrl(
  values: MarketplaceSearchValues,
  extra?: Record<string, string>
): string {
  const q = new URLSearchParams();
  const loc = values.location.trim();
  const coach = values.entity.trim();
  if (loc) q.set("location", loc);
  if (coach) q.set("coach", toSearchParamSlug(coach) || coach);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v) q.set(k, v);
    }
  }
  const qs = q.toString();
  return qs ? `/coaches?${qs}` : "/coaches";
}

export function buildMarketplaceSearchUrl(values: MarketplaceSearchValues): string {
  return values.mode === "venues" ? buildVenuesSearchUrl(values) : buildCoachesSearchUrl(values);
}
