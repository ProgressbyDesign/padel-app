/**
 * Admin-facing lifecycle presentation for coaches and venues.
 *
 * Verification (is_approved), Account (membership/claim), Launch
 * (launch_selection_status) and Visibility (publication_status) are four
 * independent axes. Approved never implies Published.
 */

import {
  isLaunchSelectionStatus,
  isOnboardingStatus,
  isPublicationStatus,
  ONBOARDING_STATUS_LABELS,
  type LaunchSelectionStatus,
  type OnboardingStatus,
  type PublicationStatus,
} from "@/lib/lifecycle/constants";

export type LifecycleBadgeTone = "neutral" | "warn" | "ok" | "bad";

export type LifecycleActionResult = {
  ok: boolean;
  message: string;
};

/** Launch labels tuned for the Top 10 curation workflow. */
export const LAUNCH_SELECTION_ADMIN_LABELS: Record<
  LaunchSelectionStatus,
  string
> = {
  unselected: "Not selected",
  selected: "Top 10 / Selected for launch",
  excluded: "Excluded",
};

export const PUBLICATION_ADMIN_LABELS: Record<PublicationStatus, string> = {
  private: "Private",
  published: "Published",
  suspended: "Suspended",
};

const LAUNCH_SELECTION_TONES: Record<LaunchSelectionStatus, LifecycleBadgeTone> =
  {
    unselected: "neutral",
    selected: "ok",
    excluded: "bad",
  };

const PUBLICATION_TONES: Record<PublicationStatus, LifecycleBadgeTone> = {
  private: "neutral",
  published: "ok",
  suspended: "bad",
};

export function launchSelectionStatusOf(value: unknown): LaunchSelectionStatus {
  return isLaunchSelectionStatus(value) ? value : "unselected";
}

export function publicationStatusOf(value: unknown): PublicationStatus {
  return isPublicationStatus(value) ? value : "private";
}

export function onboardingStatusOf(value: unknown): OnboardingStatus {
  return isOnboardingStatus(value) ? value : "not_started";
}

export function launchSelectionAdminLabel(value: unknown): string {
  return LAUNCH_SELECTION_ADMIN_LABELS[launchSelectionStatusOf(value)];
}

export function publicationAdminLabel(value: unknown): string {
  return PUBLICATION_ADMIN_LABELS[publicationStatusOf(value)];
}

export function onboardingAdminLabel(value: unknown): string {
  return ONBOARDING_STATUS_LABELS[onboardingStatusOf(value)];
}

export function verificationAdminLabel(isApproved: boolean | null | undefined) {
  return isApproved ? "Approved" : "Not approved";
}

export function accountAdminLabel(hasAccount: boolean | null | undefined) {
  return hasAccount ? "Managed" : "Unclaimed";
}

/**
 * Publishing is deliberate: a profile must be selected for launch first so
 * Launch and Visibility stay independently meaningful.
 */
export function canPublishForLaunch(launchSelectionStatus: unknown): boolean {
  return launchSelectionStatusOf(launchSelectionStatus) === "selected";
}

export type LifecycleSummaryRow = {
  id: "verification" | "account" | "launch" | "visibility";
  label: string;
  value: string;
  tone: LifecycleBadgeTone;
  hint: string;
};

export function buildAdminLifecycleSummary(input: {
  isApproved: boolean | null | undefined;
  hasAccount: boolean | null | undefined;
  launchSelectionStatus: unknown;
  publicationStatus: unknown;
}): LifecycleSummaryRow[] {
  const launch = launchSelectionStatusOf(input.launchSelectionStatus);
  const publication = publicationStatusOf(input.publicationStatus);

  return [
    {
      id: "verification",
      label: "Verification",
      value: verificationAdminLabel(input.isApproved),
      tone: input.isApproved ? "ok" : "neutral",
      hint: "Data quality review. Does not make the profile public.",
    },
    {
      id: "account",
      label: "Account",
      value: accountAdminLabel(input.hasAccount),
      tone: input.hasAccount ? "ok" : "neutral",
      hint: "Whether someone manages this profile. Not required to publish.",
    },
    {
      id: "launch",
      label: "Launch",
      value: LAUNCH_SELECTION_ADMIN_LABELS[launch],
      tone: LAUNCH_SELECTION_TONES[launch],
      hint: "Curation for the launch shortlist. Does not publish on its own.",
    },
    {
      id: "visibility",
      label: "Visibility",
      value: PUBLICATION_ADMIN_LABELS[publication],
      tone: PUBLICATION_TONES[publication],
      hint: "The only state that controls anonymous public visibility.",
    },
  ];
}

/** Public directory visibility depends solely on publication status. */
export function isPubliclyVisibleForDirectory(input: {
  publicationStatus: unknown;
  isApproved?: boolean | null;
  hasAccount?: boolean | null;
}): boolean {
  return publicationStatusOf(input.publicationStatus) === "published";
}
