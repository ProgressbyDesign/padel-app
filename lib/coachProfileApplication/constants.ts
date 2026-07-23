/** Constants for authenticated coach profile applications (not legacy /join). */

export const COACH_APPLICATION_STEPS = [
  { step: 1, slug: "about", label: "About you" },
  { step: 2, slug: "locations", label: "Where you coach" },
  { step: 3, slug: "coaching", label: "Your coaching" },
  { step: 4, slug: "review", label: "Review" },
] as const;

export const COACH_APPLICATION_TOTAL_STEPS = COACH_APPLICATION_STEPS.length;

export const COACH_APPLICATION_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "changes_requested",
  "approved",
  "declined",
  "withdrawn",
] as const;

export type CoachApplicationStatus =
  (typeof COACH_APPLICATION_STATUSES)[number];

export const EDITABLE_APPLICATION_STATUSES = [
  "draft",
  "changes_requested",
] as const satisfies readonly CoachApplicationStatus[];

export const COACHING_ROLES = [
  { value: "padel_coach", label: "Padel coach" },
  { value: "head_coach", label: "Head coach" },
  { value: "performance_coach", label: "Performance coach" },
  {
    value: "junior_development_coach",
    label: "Junior development coach",
  },
  {
    value: "former_professional_player_and_coach",
    label: "Former professional player and coach",
  },
  { value: "other", label: "Other" },
] as const;

export type CoachingRoleValue = (typeof COACHING_ROLES)[number]["value"];

export const PLAYER_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  {
    value: "competitive_professional",
    label: "Competitive / professional",
  },
] as const;

export type PlayerLevelValue = (typeof PLAYER_LEVELS)[number]["value"];

export const AUDIENCES = [
  { value: "adults", label: "Adults" },
  { value: "juniors", label: "Juniors" },
] as const;

export type AudienceValue = (typeof AUDIENCES)[number]["value"];

export const COACHING_OUTCOMES = [
  { value: "learn_fundamentals", label: "Learn padel fundamentals" },
  { value: "improve_technique", label: "Improve technique" },
  { value: "improve_match_tactics", label: "Improve match tactics" },
  { value: "prepare_for_competition", label: "Prepare for competition" },
  { value: "build_confidence", label: "Build confidence" },
  {
    value: "improve_fitness_movement",
    label: "Improve fitness and movement",
  },
  { value: "junior_development", label: "Junior player development" },
  {
    value: "high_performance_development",
    label: "High-performance development",
  },
] as const;

export type CoachingOutcomeValue = (typeof COACHING_OUTCOMES)[number]["value"];

export const APPLICATION_COUNTRIES = [
  "Spain",
  "Italy",
  "Sweden",
  "France",
  "Portugal",
  "United Kingdom",
  "Germany",
  "Belgium",
  "Netherlands",
  "United Arab Emirates",
] as const;

export type ApplicationCountry = (typeof APPLICATION_COUNTRIES)[number];

/** Known cities from imported venue data — suggestions only; free text still allowed. */
export const CITY_SUGGESTIONS_BY_COUNTRY: Record<
  ApplicationCountry,
  readonly string[]
> = {
  Spain: [
    "Alicante",
    "Barcelona",
    "Madrid",
    "Malaga",
    "Murcia",
    "Seville",
    "Valencia",
  ],
  Italy: ["Bologna", "Milan", "Naples", "Rome", "Turin"],
  Sweden: ["Gothenburg", "Helsingborg", "Malmo", "Stockholm", "Uppsala"],
  France: ["Bordeaux", "Marseille", "Nice", "Paris", "Toulouse"],
  Portugal: ["Albufeira", "Cascais", "Faro", "Lisbon", "Porto"],
  "United Kingdom": [
    "Bristol",
    "Edinburgh",
    "Leeds",
    "London",
    "Manchester",
  ],
  Germany: ["Berlin", "Cologne", "Frankfurt", "Hamburg", "Munich"],
  Belgium: ["Antwerp", "Bruges", "Brussels", "Ghent", "Leuven"],
  Netherlands: ["Amsterdam", "Dronten", "Utrecht", "Zwijndrecht"],
  "United Arab Emirates": [
    "Abu Dhabi",
    "Ajman",
    "Al Ain",
    "Dubai",
    "Sharjah",
  ],
};

export const MAX_APPLICATION_LOCATIONS = 10;

export const APPLICATION_STATUS_LABELS: Record<CoachApplicationStatus, string> =
  {
    draft: "Draft",
    submitted: "Submitted",
    under_review: "Under review",
    changes_requested: "Changes requested",
    approved: "Approved",
    declined: "Declined",
    withdrawn: "Withdrawn",
  };

export function isEditableApplicationStatus(
  status: string
): status is (typeof EDITABLE_APPLICATION_STATUSES)[number] {
  return (EDITABLE_APPLICATION_STATUSES as readonly string[]).includes(status);
}

export function coachingRoleLabel(value: string | null): string {
  if (!value) return "Not set";
  const match = COACHING_ROLES.find((role) => role.value === value);
  return match?.label ?? value;
}

export function optionLabel(
  options: readonly { value: string; label: string }[],
  value: string
): string {
  return options.find((option) => option.value === value)?.label ?? value;
}
