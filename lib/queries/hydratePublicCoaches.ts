import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Coach } from "@/lib/coaches";
import type { PublicCoachRow } from "@/lib/publicProfiles";
import { attachPublicCoachVenueRelationships } from "@/lib/queries/publicCoachVenues";

type AttributeRow = {
  coach_id?: string;
  audience_adults?: boolean | null;
  audience_juniors?: boolean | null;
  player_levels?: string[] | null;
};

type OutcomeRow = {
  coach_id?: string;
  outcome?: string | null;
  outcome_key?: string | null;
};

type AchievementRow = {
  coach_id?: string;
  title?: string | null;
  description?: string | null;
  year?: number | null;
  is_highlight?: boolean | null;
};

type ImageRow = {
  coach_id?: string;
  image_url?: string | null;
  is_primary?: boolean | null;
};

type LocationRow = {
  coach_id?: string;
  country?: string | null;
  city?: string | null;
  is_primary?: boolean | null;
};

export type PublicCoachHydrateOptions = {
  achievements?: boolean;
};

/**
 * Attach publication-safe child rows to public coach cores.
 * Does not load socials — those are manager/admin only after Sprint 6A.4.
 */
export async function hydratePublicCoachRows(
  supabase: SupabaseClient,
  cores: PublicCoachRow[],
  options: PublicCoachHydrateOptions = {}
): Promise<Coach[]> {
  const ids = cores.map((row) => String(row.id)).filter(Boolean);
  if (ids.length === 0) return [];

  const [attributesRes, outcomesRes, imagesRes, locationsRes, achievementsRes] =
    await Promise.all([
      supabase
        .from("coach_attributes")
        .select("coach_id, audience_adults, audience_juniors, player_levels")
        .in("coach_id", ids),
      supabase
        .from("coach_outcomes")
        .select("coach_id, outcome, outcome_key")
        .in("coach_id", ids),
      supabase
        .from("coach_images")
        .select("coach_id, image_url, is_primary")
        .in("coach_id", ids),
      supabase
        .from("coach_locations")
        .select("coach_id, country, city, is_primary")
        .in("coach_id", ids),
      options.achievements
        ? supabase
            .from("coach_achievements")
            .select("coach_id, title, description, year, is_highlight")
            .in("coach_id", ids)
        : Promise.resolve({ data: [] as AchievementRow[], error: null }),
    ]);

  const attributesByCoach = new Map<string, AttributeRow>();
  for (const row of (attributesRes.data ?? []) as AttributeRow[]) {
    const coachId = String(row.coach_id ?? "");
    if (coachId) attributesByCoach.set(coachId, row);
  }

  const outcomesByCoach = groupByCoachId((outcomesRes.data ?? []) as OutcomeRow[]);
  const imagesByCoach = groupByCoachId((imagesRes.data ?? []) as ImageRow[]);
  const locationsByCoach = groupByCoachId((locationsRes.data ?? []) as LocationRow[]);
  const achievementsByCoach = groupByCoachId(
    (achievementsRes.data ?? []) as AchievementRow[]
  );

  const withChildren: Coach[] = cores.map((row) => {
    const id = String(row.id);
    const attribute = attributesByCoach.get(id);
    return {
      id,
      name: row.name,
      slug: row.slug,
      role: row.role,
      description: row.description,
      image_url: row.image_url,
      level: row.level,
      experience_years: row.experience_years,
      rating: row.rating,
      review_count: row.review_count,
      travel_available: row.travel_available,
      price_from: row.price_from == null ? null : String(row.price_from),
      is_approved: row.is_approved,
      coach_attributes: attribute
        ? {
            audience_adults: attribute.audience_adults,
            audience_juniors: attribute.audience_juniors,
            player_levels: attribute.player_levels,
          }
        : null,
      coach_outcomes: outcomesByCoach.get(id) ?? null,
      coach_images: imagesByCoach.get(id) ?? null,
      coach_locations: locationsByCoach.get(id) ?? null,
      coach_achievements: options.achievements
        ? achievementsByCoach.get(id) ?? null
        : null,
    } as Coach;
  });

  return attachPublicCoachVenueRelationships(withChildren, supabase);
}

function groupByCoachId<T extends { coach_id?: string }>(rows: T[]): Map<string, T[]> {
  const byCoach = new Map<string, T[]>();
  for (const row of rows) {
    const coachId = String(row.coach_id ?? "");
    if (!coachId) continue;
    const list = byCoach.get(coachId) ?? [];
    list.push(row);
    byCoach.set(coachId, list);
  }
  return byCoach;
}
