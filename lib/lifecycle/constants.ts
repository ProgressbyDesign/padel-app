/**
 * Sprint 6A — Launch foundation lifecycle constants and validation.
 * Keep these independent of is_approved / data_quality / is_claimed / source.
 */

export const ACCOUNT_JOURNEYS = [
  "player",
  "coach_business",
  "travel_partner",
] as const;

export type AccountJourney = (typeof ACCOUNT_JOURNEYS)[number];

export const ACCOUNT_JOURNEY_LABELS: Record<AccountJourney, string> = {
  player: "Player",
  coach_business: "Coach / coaching business",
  travel_partner: "Travel partner",
};

export const LAUNCH_SELECTION_STATUSES = [
  "unselected",
  "selected",
  "excluded",
] as const;

export type LaunchSelectionStatus = (typeof LAUNCH_SELECTION_STATUSES)[number];

export const LAUNCH_SELECTION_LABELS: Record<LaunchSelectionStatus, string> = {
  unselected: "Unselected",
  selected: "Selected for launch",
  excluded: "Excluded from launch",
};

export const ONBOARDING_STATUSES = [
  "not_started",
  "invited",
  "in_progress",
  "complete",
] as const;

export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export const ONBOARDING_STATUS_LABELS: Record<OnboardingStatus, string> = {
  not_started: "Not started",
  invited: "Invited",
  in_progress: "In progress",
  complete: "Complete",
};

export const PUBLICATION_STATUSES = [
  "private",
  "published",
  "suspended",
] as const;

export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export const PUBLICATION_STATUS_LABELS: Record<PublicationStatus, string> = {
  private: "Private",
  published: "Published",
  suspended: "Suspended",
};

export const PUBLISHED_STATUS: PublicationStatus = "published";

export function isAccountJourney(value: unknown): value is AccountJourney {
  return (
    typeof value === "string" &&
    (ACCOUNT_JOURNEYS as readonly string[]).includes(value)
  );
}

export function isLaunchSelectionStatus(
  value: unknown
): value is LaunchSelectionStatus {
  return (
    typeof value === "string" &&
    (LAUNCH_SELECTION_STATUSES as readonly string[]).includes(value)
  );
}

export function isOnboardingStatus(value: unknown): value is OnboardingStatus {
  return (
    typeof value === "string" &&
    (ONBOARDING_STATUSES as readonly string[]).includes(value)
  );
}

export function isPublicationStatus(
  value: unknown
): value is PublicationStatus {
  return (
    typeof value === "string" &&
    (PUBLICATION_STATUSES as readonly string[]).includes(value)
  );
}

export function isPublishedStatus(value: unknown): boolean {
  return value === PUBLISHED_STATUS;
}

/** Public relationship visibility — never include imported unverified links. */
export const PUBLIC_COACH_VENUE_STATUSES = ["active"] as const;

export type LifecycleFields = {
  launch_selection_status?: string | null;
  onboarding_status?: string | null;
  publication_status?: string | null;
  selected_at?: string | null;
  selected_by_user_id?: string | null;
  onboarding_started_at?: string | null;
  onboarding_completed_at?: string | null;
  published_at?: string | null;
  published_by_user_id?: string | null;
};
