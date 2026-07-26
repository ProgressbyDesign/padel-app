/** Constants for authenticated coach profile applications (not legacy /join). */

export const COACH_APPLICATION_STEPS = [
  { step: 1, slug: "about", label: "About you" },
  { step: 2, slug: "locations", label: "Where you coach" },
  { step: 3, slug: "coaching", label: "Your coaching" },
  { step: 4, slug: "review", label: "Review" },
] as const;

export const COACH_APPLICATION_TOTAL_STEPS = COACH_APPLICATION_STEPS.length;

export const COACH_APPLICATION_MODES = [
  "create_new",
  "claim_existing",
] as const;

export type CoachApplicationMode = (typeof COACH_APPLICATION_MODES)[number];

export const COACH_APPLICATION_MODE_LABELS: Record<CoachApplicationMode, string> =
  {
    create_new: "New coach application",
    claim_existing: "Profile claim",
  };

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

export const ACTIVE_APPLICATION_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "changes_requested",
] as const satisfies readonly CoachApplicationStatus[];

export const WITHDRAWABLE_APPLICATION_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "changes_requested",
] as const satisfies readonly CoachApplicationStatus[];

export const HISTORY_APPLICATION_STATUSES = [
  "approved",
  "declined",
  "withdrawn",
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

export function isApplicationCountry(
  value: string | null | undefined
): value is ApplicationCountry {
  return (
    typeof value === "string" &&
    (APPLICATION_COUNTRIES as readonly string[]).includes(value)
  );
}

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

export function isCoachApplicationMode(
  value: string | null | undefined
): value is CoachApplicationMode {
  return (
    typeof value === "string" &&
    (COACH_APPLICATION_MODES as readonly string[]).includes(value)
  );
}

export function isEditableApplicationStatus(
  status: string
): status is (typeof EDITABLE_APPLICATION_STATUSES)[number] {
  return (EDITABLE_APPLICATION_STATUSES as readonly string[]).includes(status);
}

export function isActiveApplicationStatus(
  status: string
): status is (typeof ACTIVE_APPLICATION_STATUSES)[number] {
  return (ACTIVE_APPLICATION_STATUSES as readonly string[]).includes(status);
}

export function isWithdrawableApplicationStatus(
  status: string
): status is (typeof WITHDRAWABLE_APPLICATION_STATUSES)[number] {
  return (WITHDRAWABLE_APPLICATION_STATUSES as readonly string[]).includes(
    status
  );
}

export function isHistoryApplicationStatus(
  status: string
): status is (typeof HISTORY_APPLICATION_STATUSES)[number] {
  return (HISTORY_APPLICATION_STATUSES as readonly string[]).includes(status);
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

/** Best-effort map of free-text coach.role → application coaching_role. */
export function mapLegacyCoachRole(
  role: string | null | undefined
): { coaching_role: CoachingRoleValue; coaching_role_other: string | null } {
  const raw = role?.trim() ?? "";
  if (!raw) return { coaching_role: "padel_coach", coaching_role_other: null };
  const lower = raw.toLowerCase();
  for (const option of COACHING_ROLES) {
    if (option.value === "other") continue;
    if (
      lower === option.label.toLowerCase() ||
      lower.includes(option.label.toLowerCase()) ||
      lower.replace(/\s+/g, "_") === option.value
    ) {
      return { coaching_role: option.value, coaching_role_other: null };
    }
  }
  if (lower.includes("head")) {
    return { coaching_role: "head_coach", coaching_role_other: null };
  }
  if (lower.includes("junior")) {
    return {
      coaching_role: "junior_development_coach",
      coaching_role_other: null,
    };
  }
  if (lower.includes("performance")) {
    return { coaching_role: "performance_coach", coaching_role_other: null };
  }
  if (lower.includes("padel") && lower.includes("coach")) {
    return { coaching_role: "padel_coach", coaching_role_other: null };
  }
  return {
    coaching_role: "other",
    coaching_role_other: raw.slice(0, 100),
  };
}
