import type { CoachAchievement } from "./coaches";
import { resolveCoachImageUrl, type CoachImageEmbed } from "./coachImageResolve";
import { formatCoachPriceDisplay } from "./formatCoachPrice";
import {
  pickPrimaryVenueFromCoachRow,
  venueLocationLabels,
  type CoachVenueLinkRow,
} from "./coachVenueGeo";

type CoachAttributesEmbed = {
  audience_adults?: boolean | null;
  audience_juniors?: boolean | null;
} | null;

type CoachAchievementEmbed = {
  title?: string | null;
  description?: string | null;
  year?: number | null;
  is_highlight?: boolean | null;
};

type CoachOutcomeEmbed = {
  outcome?: string | null;
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
  coach_venues?: CoachVenueLinkRow[] | null;
  coach_attributes?: CoachAttributesEmbed | CoachAttributesEmbed[];
  coach_achievements?: CoachAchievementEmbed[] | null;
  coach_images?: CoachImageEmbed[] | null;
  coach_outcomes?: CoachOutcomeEmbed[] | null;
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

export type CoachProfileView = {
  id: string;
  name: string | null;
  slug: string | null;
  description: string | null;
  contact: CoachProfileContact;
  location: CoachProfileLocation;
  /** Human label, e.g. `5+ yrs` */
  experience: string | null;
  /** Numeric years for PLP sorting / filters */
  experienceYears: number;
  level: string | null;
  rating: CoachProfileRating;
  pricing: CoachProfilePricing;
  travel: boolean | null;
  image: string | null;
  audience: string[];
  outcomes: string[];
  /** First row from `coach_outcomes` (DB order), else first resolved outcome */
  primaryOutcome: string | null;
  achievements: CoachAchievement[];
  achievementsHero: CoachAchievement[];
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

/** Normalize any Supabase `coaches` row (+ optional embeds) into one UI model. */
export function rawCoachRowToProfileView(coachRow: CoachPdpQueryRow): CoachProfileView {
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

  const image = resolveCoachImageUrl(coachRow.coach_images, coachRow.image_url);

  const fromOutcomesTable =
    coachRow.coach_outcomes?.map((o) => o.outcome?.trim()).filter((s): s is string => Boolean(s)) ?? [];
  const outcomes =
    fromOutcomesTable.length > 0
      ? fromOutcomesTable
      : coachRow.outcome?.trim()
        ? [coachRow.outcome.trim()]
        : [];

  const primaryFromRelation = coachRow.coach_outcomes?.[0]?.outcome?.trim() || null;
  const primaryOutcome = primaryFromRelation || outcomes[0] || null;

  const primaryVenue = pickPrimaryVenueFromCoachRow(coachRow);
  const { city, country, full: fullLocation } = venueLocationLabels(primaryVenue);
  const full = fullLocation;

  const expYears = parseExperienceYears(coachRow.experience_years);
  const experience = expYears > 0 ? `${expYears}+ yrs` : null;

  const pricing = formatPricingDisplayFrom(coachRow.price_from);

  return {
    id: String(coachRow.id ?? "").trim(),
    name: coachRow.name ?? null,
    slug: toTrimmedString(coachRow.slug),
    description: coachRow.description ?? null,
    contact: {
      email: toTrimmedString(coachRow.email),
      phone: toTrimmedString(coachRow.phone),
    },
    location: { city, country, full: full || "" },
    experience,
    experienceYears: expYears,
    level: toTrimmedString(coachRow.level),
    rating: {
      score: parseRatingScore(coachRow.rating),
      count: parseReviewCount(coachRow.review_count),
    },
    pricing,
    travel: coachRow.travel_available ?? null,
    image,
    audience,
    outcomes,
    primaryOutcome,
    achievements,
    achievementsHero,
  };
}
