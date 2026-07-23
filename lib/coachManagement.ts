import { COACHING_OUTCOMES } from "@/lib/coachProfileApplication/constants";

export type CoachDetailsFormValues = {
  name: string;
  role: string;
  description: string;
  experience_years: string;
  phone: string;
  travel_available: boolean;
  price_from: string;
  audience_adults: boolean;
  audience_juniors: boolean;
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

export function coachOutcomeValuesFromRows(outcomes: string[]): string[] {
  const selected = new Set<string>();
  for (const outcome of outcomes) {
    const normalized = outcome.trim().toLowerCase();
    const match = COACH_PROFILE_OUTCOME_OPTIONS.find(
      (option) =>
        option.value === outcome ||
        option.label.toLowerCase() === normalized ||
        option.value.replace(/_/g, " ") === normalized
    );
    if (match) selected.add(match.value);
  }
  return [...selected];
}

export function initialCoachDetailsState(input: {
  name: string | null;
  role: string | null;
  description: string | null;
  experience_years: number | null;
  phone: string | null;
  travel_available: boolean | null;
  price_from: number | null;
  audienceAdults: boolean;
  audienceJuniors: boolean;
  outcomes: string[];
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
      travel_available: Boolean(input.travel_available),
      price_from: input.price_from === null ? "" : String(input.price_from),
      audience_adults: input.audienceAdults,
      audience_juniors: input.audienceJuniors,
      outcomes: coachOutcomeValuesFromRows(input.outcomes),
    },
  };
}
