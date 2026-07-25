import {
  COACHING_OUTCOMES,
  PLAYER_LEVELS,
  type PlayerLevelValue,
} from "@/lib/coachProfileApplication/constants";

export type CoachDetailsFormValues = {
  name: string;
  role: string;
  description: string;
  experience_years: string;
  phone: string;
  email: string;
  travel_available: boolean;
  price_from: string;
  audience_adults: boolean;
  audience_juniors: boolean;
  player_levels: string[];
  outcomes: string[];
};

export type CoachDetailsField =
  | keyof CoachDetailsFormValues
  | "form";

export type CoachDetailsUpdateState = {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: Partial<Record<CoachDetailsField, string>>;
  revision: number;
  values: CoachDetailsFormValues;
};

/** Controlled outcome labels stored in coach_outcomes for public display. */
export const COACH_PROFILE_OUTCOME_OPTIONS = COACHING_OUTCOMES.map((option) => ({
  value: option.value,
  label: option.label,
}));

export const COACH_PROFILE_LEVEL_OPTIONS = PLAYER_LEVELS.map((option) => ({
  value: option.value,
  label: option.label,
}));

export function coachOutcomeLabel(valueOrLabel: string): string {
  const normalized = valueOrLabel.trim().toLowerCase();
  const match = COACH_PROFILE_OUTCOME_OPTIONS.find(
    (option) =>
      option.value === valueOrLabel ||
      option.label.toLowerCase() === normalized ||
      option.value.replace(/_/g, " ") === normalized
  );
  return match?.label ?? valueOrLabel;
}

export function coachOutcomeValuesFromRows(
  outcomes: Array<string | { outcome?: string | null; outcome_key?: string | null }>
): string[] {
  const selected = new Set<string>();
  for (const row of outcomes) {
    const key =
      typeof row === "string" ? null : row.outcome_key?.trim() || null;
    const label =
      typeof row === "string" ? row : row.outcome?.trim() || "";
    if (key) {
      const byKey = COACH_PROFILE_OUTCOME_OPTIONS.find(
        (option) => option.value === key
      );
      if (byKey) {
        selected.add(byKey.value);
        continue;
      }
    }
    const normalized = label.toLowerCase();
    const match = COACH_PROFILE_OUTCOME_OPTIONS.find(
      (option) =>
        option.value === label ||
        option.label.toLowerCase() === normalized ||
        option.value.replace(/_/g, " ") === normalized
    );
    if (match) selected.add(match.value);
  }
  return [...selected];
}

export function isPlayerLevelValue(value: string): value is PlayerLevelValue {
  return PLAYER_LEVELS.some((option) => option.value === value);
}

export function initialCoachDetailsState(input: {
  name: string | null;
  role: string | null;
  description: string | null;
  experience_years: number | null;
  phone: string | null;
  email: string | null;
  travel_available: boolean | null;
  price_from: number | null;
  audienceAdults: boolean;
  audienceJuniors: boolean;
  playerLevels: string[];
  outcomes: Array<string | { outcome?: string | null; outcome_key?: string | null }>;
}): CoachDetailsUpdateState {
  return {
    status: "idle",
    message: null,
    fieldErrors: {},
    revision: 0,
    values: {
      name: input.name ?? "",
      role: input.role ?? "",
      description: input.description ?? "",
      experience_years:
        input.experience_years === null ? "" : String(input.experience_years),
      phone: input.phone ?? "",
      email: input.email ?? "",
      travel_available: Boolean(input.travel_available),
      price_from: input.price_from === null ? "" : String(input.price_from),
      audience_adults: input.audienceAdults,
      audience_juniors: input.audienceJuniors,
      player_levels: input.playerLevels.filter(isPlayerLevelValue),
      outcomes: coachOutcomeValuesFromRows(input.outcomes),
    },
  };
}
