import type { CoachAchievement } from "./coaches";
import { coachOutcomeLabel } from "./coachManagement";
import {
  resolveCoachGalleryUrls,
  resolveCoachImageUrl,
  type CoachImageEmbed,
} from "./coachImageResolve";
import { formatCoachLocationLabel } from "./coachLocations";
import { optionLabel, PLAYER_LEVELS } from "./coachProfileApplication/constants";
import type { CoachBadge } from "./coachProfileCompletion";
import { formatCoachPriceDisplay } from "./formatCoachPrice";
import {
  pickPrimaryVenueFromCoachRow,
  venueLocationLabels,
  type CoachVenueLinkRow,
} from "./coachVenueGeo";
import {
  coachSocialPlatformLabel,
  validPublicCoachSocials,
  type CoachSocialRow,
} from "./coachSocials";

type CoachAttributesEmbed = {
  audience_adults?: boolean | null;
  audience_juniors?: boolean | null;
  player_levels?: string[] | null;
} | null;

type CoachAchievementEmbed = {
  title?: string | null;
  description?: string | null;
  year?: number | null;
  is_highlight?: boolean | null;
};

type CoachOutcomeEmbed = {
  outcome?: string | null;
  outcome_key?: string | null;
};

type CoachLocationEmbed = {
  country?: string | null;
  city?: string | null;
  is_primary?: boolean | null;
};

type CoachSocialEmbed = {
  id?: string | null;
  coach_id?: string | null;
  platform?: string | null;
  url?: string | null;
  is_primary?: boolean | null;
  created_at?: string | null;
};

/**
 * Raw `coaches` row from PDP nested `select` or `select("*")` fallback.
 * Extra columns from `*` are allowed for mapping.
 */
export type CoachPdpQueryRow = {
  id: string;
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  email?: string | null;
  phone?: string | null;
  level?: string | null;
  experience_years?: number | string | null;
  rating?: number | string | null;
  review_count?: number | null;
  price_from?: string | number | null;
  travel_available?: boolean | null;
  /** Legacy column — used when `coach_outcomes` is empty */
  outcome?: string | null;
  role?: string | null;
  image_url?: string | null;
  specialty?: string | null;
  is_approved?: boolean | null;
  is_claimed?: boolean | null;
  coach_venues?: CoachVenueLinkRow[] | null;
  coach_attributes?: CoachAttributesEmbed | CoachAttributesEmbed[];
  coach_achievements?: CoachAchievementEmbed[] | null;
  coach_images?: CoachImageEmbed[] | null;
  coach_outcomes?: CoachOutcomeEmbed[] | null;
  coach_locations?: CoachLocationEmbed[] | null;
  coach_socials?: CoachSocialEmbed[] | null;
};

export type CoachProfileContact = {
  email: string | null;
  phone: string | null;
};

export type CoachProfileLocation = {
  city: string | null;
  country: string | null;
  full: string;
};

export type CoachProfileRating = {
  score: number | null;
  count: number | null;
};

export type CoachProfilePricing = {
  from: string | null;
  /** e.g. `From €55` — null when no price */
  displayFrom: string | null;
};

export type CoachProfileSocial = {
  platform: string;
  label: string;
  url: string;
};

export type CoachProfileView = {
  id: string;
  name: string | null;
  slug: string | null;
  role: string | null;
  description: string | null;
  contact: CoachProfileContact;
  location: CoachProfileLocation;
  /** Structured coaching locations (primary first); empty when unavailable */
  locations: CoachProfileLocation[];
  /** Human label, e.g. `5+ yrs` */
  experience: string | null;
  /** Numeric years for PLP sorting / filters */
  experienceYears: number;
  /** Legacy coaches.level skill band */
  level: string | null;
  /** Structured player_levels labels (preferred for PDP) */
  playerLevels: string[];
  rating: CoachProfileRating;
  pricing: CoachProfilePricing;
  travel: boolean | null;
  image: string | null;
  gallery: string[];
  audience: string[];
  outcomes: string[];
  /** First row from `coach_outcomes` (DB order), else first resolved outcome */
  primaryOutcome: string | null;
  achievements: CoachAchievement[];
  achievementsHero: CoachAchievement[];
  socials: CoachProfileSocial[];
  isApproved: boolean;
  isClaimed: boolean;
  badges: CoachBadge[];
};

function normalizeAttributes(raw: CoachPdpQueryRow["coach_attributes"]): CoachAttributesEmbed {
  if (raw == null) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

function toTrimmedString(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t.length > 0 ? t : null;
}

function parseRatingScore(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseReviewCount(raw: unknown): number | null {
  if (typeof raw === "number" && raw > 0) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

function formatPricingDisplayFrom(raw: unknown): { from: string | null; displayFrom: string | null } {
  const displayFrom = formatCoachPriceDisplay(raw);
  if (!displayFrom) return { from: null, displayFrom: null };
  const from = displayFrom.replace(/^from\s+/i, "").trim() || displayFrom;
  return { from, displayFrom };
}

function parseExperienceYears(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return 0;
}

function resolveOutcomeLabels(rows: CoachOutcomeEmbed[] | null | undefined): string[] {
  if (!rows?.length) return [];
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const key = row.outcome_key?.trim();
    const raw = key || row.outcome?.trim() || "";
    if (!raw) continue;
    const label = coachOutcomeLabel(raw);
    const dedupe = label.toLowerCase();
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    labels.push(label);
  }
  return labels;
}

function resolvePlayerLevelLabels(raw: unknown, legacyLevel: string | null): string[] {
  const fromStructured = Array.isArray(raw)
    ? raw
        .map((value) => optionLabel(PLAYER_LEVELS, String(value)))
        .filter((label) => label.trim().length > 0)
    : [];
  if (fromStructured.length > 0) return [...new Set(fromStructured)];
  return legacyLevel?.trim() ? [legacyLevel.trim()] : [];
}

function resolveStructuredLocations(
  rows: CoachLocationEmbed[] | null | undefined
): CoachProfileLocation[] {
  if (!rows?.length) return [];
  const sorted = [...rows].sort(
    (a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary))
  );
  const out: CoachProfileLocation[] = [];
  const seen = new Set<string>();
  for (const row of sorted) {
    const city = toTrimmedString(row.city);
    const country = toTrimmedString(row.country);
    if (!city && !country) continue;
    const full = formatCoachLocationLabel({
      city: city ?? "",
      country: country ?? "",
    });
    const key = full.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ city, country, full });
  }
  return out;
}

function resolveSocials(
  coachId: string,
  rows: CoachSocialEmbed[] | null | undefined
): CoachProfileSocial[] {
  const mapped: CoachSocialRow[] = (rows ?? [])
    .filter((row) => row.platform && row.url)
    .map((row) => ({
      id: String(row.id ?? `${row.platform}-${row.url}`),
      coach_id: String(row.coach_id ?? coachId),
      platform: String(row.platform),
      url: String(row.url),
      is_primary: Boolean(row.is_primary),
      created_at: row.created_at ? String(row.created_at) : null,
    }));
  return validPublicCoachSocials(mapped).map((social) => ({
    platform: social.platform,
    label: coachSocialPlatformLabel(social.platform),
    url: social.url,
  }));
}

function buildPublicBadges(input: {
  isApproved: boolean;
  hasPrimaryLocation: boolean;
  hasDescription: boolean;
  hasAudience: boolean;
  playerLevels: string[];
  outcomes: string[];
  hasPrimaryImage: boolean;
  activeVenueCount: number;
  availabilityLive: boolean;
}): CoachBadge[] {
  const essentialDone =
    input.hasPrimaryLocation &&
    input.hasDescription &&
    input.hasAudience &&
    input.playerLevels.length > 0 &&
    input.outcomes.length > 0 &&
    input.hasPrimaryImage;
  const badges: CoachBadge[] = [];
  if (input.isApproved) badges.push({ id: "verified", label: "Verified coach" });
  if (essentialDone) badges.push({ id: "complete", label: "Complete profile" });
  if (input.activeVenueCount > 0) {
    badges.push({ id: "venue_confirmed", label: "Venue confirmed" });
  }
  if (input.availabilityLive) {
    badges.push({ id: "availability_live", label: "Availability live" });
  }
  return badges;
}

/** Normalize any Supabase `coaches` row (+ optional embeds) into one UI model. */
export function rawCoachRowToProfileView(
  coachRow: CoachPdpQueryRow,
  options?: { availabilityLive?: boolean }
): CoachProfileView {
  const attrs = normalizeAttributes(coachRow.coach_attributes);
  const audience = [
    attrs?.audience_adults ? "Adults" : null,
    attrs?.audience_juniors ? "Juniors" : null,
  ].filter(Boolean) as string[];

  const rawAchievements = coachRow.coach_achievements ?? [];
  const achievements: CoachAchievement[] = rawAchievements
    .slice()
    .sort(
      (a, b) =>
        Number(Boolean(b.is_highlight)) - Number(Boolean(a.is_highlight)) ||
        (Number(b.year) || 0) - (Number(a.year) || 0)
    )
    .map((a) => ({
      title: (a.title ?? "").trim(),
      description: a.description?.trim() || undefined,
      year: typeof a.year === "number" && Number.isFinite(a.year) ? a.year : undefined,
      is_highlight: Boolean(a.is_highlight),
    }))
    .filter((a) => a.title.length > 0);

  const achievementsHero = achievements.slice(0, 3);

  const gallery = resolveCoachGalleryUrls(coachRow.coach_images, coachRow.image_url);
  const image = resolveCoachImageUrl(coachRow.coach_images, coachRow.image_url);

  const fromOutcomesTable = resolveOutcomeLabels(coachRow.coach_outcomes);
  const outcomes =
    fromOutcomesTable.length > 0
      ? fromOutcomesTable
      : coachRow.outcome?.trim()
        ? [coachOutcomeLabel(coachRow.outcome.trim())]
        : [];

  const primaryFromRelation =
    (coachRow.coach_outcomes?.[0]?.outcome_key
      ? coachOutcomeLabel(coachRow.coach_outcomes[0].outcome_key)
      : null) ||
    (coachRow.coach_outcomes?.[0]?.outcome
      ? coachOutcomeLabel(coachRow.coach_outcomes[0].outcome)
      : null) ||
    outcomes[0] ||
    null;
  const primaryOutcome = primaryFromRelation;

  const structuredLocations = resolveStructuredLocations(coachRow.coach_locations);
  const primaryVenue = pickPrimaryVenueFromCoachRow(coachRow);
  const venueLocation = venueLocationLabels(primaryVenue);
  const location: CoachProfileLocation =
    structuredLocations[0] ??
    (venueLocation.full
      ? {
          city: venueLocation.city,
          country: venueLocation.country,
          full: venueLocation.full,
        }
      : { city: null, country: null, full: "" });

  const expYears = parseExperienceYears(coachRow.experience_years);
  const experience = expYears > 0 ? `${expYears}+ yrs` : null;
  const pricing = formatPricingDisplayFrom(coachRow.price_from);
  const legacyLevel = toTrimmedString(coachRow.level);
  const playerLevels = resolvePlayerLevelLabels(attrs?.player_levels, legacyLevel);
  const coachId = String(coachRow.id ?? "").trim();
  const socials = resolveSocials(coachId, coachRow.coach_socials);
  const isApproved = Boolean(coachRow.is_approved);
  const isClaimed = Boolean(coachRow.is_claimed);
  const activeVenueCount = (coachRow.coach_venues ?? []).length;
  const hasDescription =
    Boolean(coachRow.description?.trim()) &&
    (coachRow.description?.trim().length ?? 0) >= 40;

  const badges = buildPublicBadges({
    isApproved,
    hasPrimaryLocation: Boolean(location.full),
    hasDescription,
    hasAudience: audience.length > 0,
    playerLevels,
    outcomes,
    hasPrimaryImage: Boolean(image),
    activeVenueCount,
    availabilityLive: Boolean(options?.availabilityLive),
  });

  return {
    id: coachId,
    name: coachRow.name ?? null,
    slug: toTrimmedString(coachRow.slug),
    role: toTrimmedString(coachRow.role),
    description: coachRow.description ?? null,
    contact: {
      email: toTrimmedString(coachRow.email),
      phone: toTrimmedString(coachRow.phone),
    },
    location,
    locations: structuredLocations,
    experience,
    experienceYears: expYears,
    level: legacyLevel,
    playerLevels,
    rating: {
      score: parseRatingScore(coachRow.rating),
      count: parseReviewCount(coachRow.review_count),
    },
    pricing,
    travel: coachRow.travel_available ?? null,
    image,
    gallery,
    audience,
    outcomes,
    primaryOutcome,
    achievements,
    achievementsHero,
    socials,
    isApproved,
    isClaimed,
    badges,
  };
}
