import { isPublishedStatus } from "@/lib/lifecycle/constants";

/**
 * Approval wording for the admin coach review panel.
 *
 * Approval, onboarding and publication are separate lifecycle concepts, so the
 * copy never asserts publication up front. The outcome sentence is derived
 * from the coach's actual `publication_status` after approval: newly approved
 * coaches stay private unless they were already published.
 */
export const APPROVE_COACH_LABEL = "Approve coach";
export const APPROVE_CLAIM_LABEL = "Approve claim";
export const COACH_APPROVED_MESSAGE = "Coach application approved.";

export function coachApprovalOutcomeMessage(publicationStatus: unknown): string {
  const access = "The coach now has access to manage their profile.";
  if (isPublishedStatus(publicationStatus)) {
    return `${COACH_APPROVED_MESSAGE} ${access} The profile is published on the website.`;
  }
  return `${COACH_APPROVED_MESSAGE} ${access} Complete onboarding and publish the profile when it is ready.`;
}

export const POSSIBLE_DUPLICATE_MESSAGE =
  "Possible existing coach found. Choose whether to use an existing profile or create a separate coach.";
