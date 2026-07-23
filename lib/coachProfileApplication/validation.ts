import {
  APPLICATION_COUNTRIES,
  AUDIENCES,
  COACHING_OUTCOMES,
  COACHING_ROLES,
  MAX_APPLICATION_LOCATIONS,
  PLAYER_LEVELS,
  type ApplicationCountry,
  type AudienceValue,
  type CoachingOutcomeValue,
  type CoachingRoleValue,
  type PlayerLevelValue,
} from "./constants";
import type { CoachApplicationLocationInput } from "./types";

export type StepOneInput = {
  full_name: string;
  phone: string;
  coaching_role: string;
  coaching_role_other: string;
  experience_years: string;
};

export type StepThreeInput = {
  player_levels: string[];
  audiences: string[];
  outcomes: string[];
  description: string;
};

function isCoachingRole(value: string): value is CoachingRoleValue {
  return COACHING_ROLES.some((role) => role.value === value);
}

function isPlayerLevel(value: string): value is PlayerLevelValue {
  return PLAYER_LEVELS.some((level) => level.value === value);
}

function isAudience(value: string): value is AudienceValue {
  return AUDIENCES.some((audience) => audience.value === value);
}

function isOutcome(value: string): value is CoachingOutcomeValue {
  return COACHING_OUTCOMES.some((outcome) => outcome.value === value);
}

export function isApplicationCountry(
  value: string
): value is ApplicationCountry {
  return (APPLICATION_COUNTRIES as readonly string[]).includes(value);
}

export function normalizeAllowList<T extends string>(
  values: string[],
  predicate: (value: string) => value is T
): T[] {
  const unique = new Set<T>();
  for (const value of values) {
    if (predicate(value)) unique.add(value);
  }
  return [...unique];
}

export function validateStepOneDraft(
  input: StepOneInput
): Record<string, string> {
  const errors: Record<string, string> = {};
  const fullName = input.full_name.trim();
  const phone = input.phone.trim();
  const other = input.coaching_role_other.trim();

  if (fullName && (fullName.length < 2 || fullName.length > 120)) {
    errors.full_name = "Full name must be between 2 and 120 characters.";
  }

  if (phone && (phone.length < 5 || phone.length > 40)) {
    errors.phone = "Phone must be between 5 and 40 characters.";
  }

  if (input.coaching_role && !isCoachingRole(input.coaching_role)) {
    errors.coaching_role = "Choose a valid coaching role.";
  }

  if (input.coaching_role === "other") {
    if (!other || other.length < 2 || other.length > 100) {
      errors.coaching_role_other =
        "Describe your role in 2–100 characters when selecting Other.";
    }
  }

  if (input.experience_years.trim()) {
    const years = Number(input.experience_years);
    if (
      !Number.isInteger(years) ||
      years < 0 ||
      years > 60
    ) {
      errors.experience_years = "Experience must be a whole number from 0 to 60.";
    }
  }

  return errors;
}

export function validateStepOneForSubmit(
  input: StepOneInput
): Record<string, string> {
  const errors = validateStepOneDraft(input);
  if (!input.full_name.trim()) {
    errors.full_name = "Enter your full name.";
  }
  if (!input.phone.trim()) {
    errors.phone = "Enter a phone number.";
  }
  if (!input.coaching_role || !isCoachingRole(input.coaching_role)) {
    errors.coaching_role = "Choose a coaching role.";
  }
  if (!input.experience_years.trim()) {
    errors.experience_years = "Enter your years of coaching experience.";
  }
  return errors;
}

export function validateLocations(
  locations: CoachApplicationLocationInput[],
  { requireAtLeastOne }: { requireAtLeastOne: boolean }
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (locations.length > MAX_APPLICATION_LOCATIONS) {
    errors.locations = `You can add up to ${MAX_APPLICATION_LOCATIONS} locations.`;
    return errors;
  }

  if (requireAtLeastOne && locations.length === 0) {
    errors.locations = "Add at least one coaching location.";
    return errors;
  }

  const seen = new Set<string>();
  let primaryCount = 0;

  locations.forEach((location, index) => {
    const country = location.country.trim();
    const city = location.city.trim();
    const prefix = `locations.${index}`;

    if (!isApplicationCountry(country)) {
      errors[`${prefix}.country`] = "Choose a supported country.";
    }

    if (!city || city.length < 2 || city.length > 120) {
      errors[`${prefix}.city`] = "City must be between 2 and 120 characters.";
    }

    if (country && city) {
      const key = `${country.toLowerCase()}::${city.toLowerCase()}`;
      if (seen.has(key)) {
        errors[`${prefix}.city`] =
          "This city and country combination is already listed.";
      }
      seen.add(key);
    }

    if (location.is_primary) primaryCount += 1;
  });

  if (locations.length > 0 && primaryCount !== 1) {
    errors.locations = "Exactly one location must be marked as primary.";
  }

  return errors;
}

export function validateStepThreeDraft(
  input: StepThreeInput
): Record<string, string> {
  const errors: Record<string, string> = {};
  const description = input.description.trim();

  const invalidLevels = input.player_levels.filter((value) => !isPlayerLevel(value));
  if (invalidLevels.length > 0) {
    errors.player_levels = "Remove unsupported player levels.";
  }

  const invalidAudiences = input.audiences.filter((value) => !isAudience(value));
  if (invalidAudiences.length > 0) {
    errors.audiences = "Remove unsupported audiences.";
  }

  const invalidOutcomes = input.outcomes.filter((value) => !isOutcome(value));
  if (invalidOutcomes.length > 0) {
    errors.outcomes = "Remove unsupported coaching outcomes.";
  }

  if (
    description &&
    (description.length < 40 || description.length > 500)
  ) {
    errors.description =
      "Introduction must be between 40 and 500 characters.";
  }

  return errors;
}

export function validateStepThreeForSubmit(
  input: StepThreeInput
): Record<string, string> {
  const errors = validateStepThreeDraft(input);
  const levels = normalizeAllowList(input.player_levels, isPlayerLevel);
  const audiences = normalizeAllowList(input.audiences, isAudience);
  const outcomes = normalizeAllowList(input.outcomes, isOutcome);

  if (levels.length === 0) {
    errors.player_levels = "Select at least one player level.";
  }
  if (audiences.length === 0) {
    errors.audiences = "Select at least one audience.";
  }
  if (outcomes.length === 0) {
    errors.outcomes = "Select at least one coaching outcome.";
  }
  if (!input.description.trim()) {
    errors.description = "Write a short introduction for players.";
  }
  return errors;
}

export function parseStepOnePayload(input: StepOneInput) {
  const coachingRole = isCoachingRole(input.coaching_role)
    ? input.coaching_role
    : null;
  const experienceRaw = input.experience_years.trim();
  const experienceYears = experienceRaw ? Number(experienceRaw) : null;

  return {
    full_name: input.full_name.trim() || null,
    phone: input.phone.trim() || null,
    coaching_role: coachingRole,
    coaching_role_other:
      coachingRole === "other"
        ? input.coaching_role_other.trim() || null
        : null,
    experience_years:
      experienceYears !== null && Number.isInteger(experienceYears)
        ? experienceYears
        : null,
  };
}

export function parseStepThreePayload(input: StepThreeInput) {
  return {
    player_levels: normalizeAllowList(input.player_levels, isPlayerLevel),
    audiences: normalizeAllowList(input.audiences, isAudience),
    outcomes: normalizeAllowList(input.outcomes, isOutcome),
    description: input.description.trim() || null,
  };
}

export function normalizeLocationRows(
  locations: CoachApplicationLocationInput[]
): CoachApplicationLocationInput[] {
  const normalized = locations.map((location) => ({
    country: location.country.trim(),
    city: location.city.trim(),
    is_primary: Boolean(location.is_primary),
  }));

  if (normalized.length === 0) return normalized;

  const primaryIndex = normalized.findIndex((row) => row.is_primary);
  return normalized.map((row, index) => ({
    ...row,
    is_primary: primaryIndex >= 0 ? index === primaryIndex : index === 0,
  }));
}
