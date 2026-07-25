export const MAX_ACHIEVEMENT_TITLE = 160;
export const MIN_ACHIEVEMENT_TITLE = 2;
export const MAX_ACHIEVEMENT_DESCRIPTION = 1000;
export const MIN_ACHIEVEMENT_YEAR = 1900;
export const MAX_ACHIEVEMENT_YEAR = 2100;

export type CoachAchievementRow = {
  id: string;
  coach_id: string;
  title: string;
  description: string | null;
  year: number | null;
  is_highlight: boolean;
  created_at: string | null;
};

export type AchievementValidation = {
  title: string;
  description: string | null;
  year: number | null;
  is_highlight: boolean;
};

export function validateAchievementInput(input: {
  title: string;
  description: string;
  year: string;
  is_highlight: boolean;
}): { ok: true; value: AchievementValidation } | { ok: false; message: string } {
  const title = input.title.trim();
  if (title.length < MIN_ACHIEVEMENT_TITLE || title.length > MAX_ACHIEVEMENT_TITLE) {
    return {
      ok: false,
      message: `Title must be between ${MIN_ACHIEVEMENT_TITLE} and ${MAX_ACHIEVEMENT_TITLE} characters.`,
    };
  }

  const descriptionRaw = input.description.trim();
  if (descriptionRaw.length > MAX_ACHIEVEMENT_DESCRIPTION) {
    return {
      ok: false,
      message: `Description must be ${MAX_ACHIEVEMENT_DESCRIPTION} characters or fewer.`,
    };
  }

  let year: number | null = null;
  const yearRaw = input.year.trim();
  if (yearRaw) {
    const parsed = Number(yearRaw);
    if (
      !Number.isInteger(parsed) ||
      parsed < MIN_ACHIEVEMENT_YEAR ||
      parsed > MAX_ACHIEVEMENT_YEAR
    ) {
      return {
        ok: false,
        message: `Year must be between ${MIN_ACHIEVEMENT_YEAR} and ${MAX_ACHIEVEMENT_YEAR}.`,
      };
    }
    year = parsed;
  }

  return {
    ok: true,
    value: {
      title,
      description: descriptionRaw || null,
      year,
      is_highlight: Boolean(input.is_highlight),
    },
  };
}

export function sortCoachAchievements(
  rows: CoachAchievementRow[]
): CoachAchievementRow[] {
  return [...rows].sort((left, right) => {
    if (left.is_highlight !== right.is_highlight) {
      return left.is_highlight ? -1 : 1;
    }
    const leftYear = left.year ?? -1;
    const rightYear = right.year ?? -1;
    if (leftYear !== rightYear) return rightYear - leftYear;
    return (right.created_at ?? "").localeCompare(left.created_at ?? "");
  });
}
