/** Constants for authenticated venue profile applications. */

export const VENUE_APPLICATION_STEPS = [
  { step: 1, slug: "role", label: "Your role" },
  { step: 2, slug: "venue", label: "Venue details" },
  { step: 3, slug: "confirmation", label: "Confirmation" },
  { step: 4, slug: "review", label: "Review" },
] as const;

export const VENUE_APPLICATION_TOTAL_STEPS = VENUE_APPLICATION_STEPS.length;

export const VENUE_APPLICATION_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "changes_requested",
  "approved",
  "declined",
  "withdrawn",
] as const;

export type VenueApplicationStatus =
  (typeof VENUE_APPLICATION_STATUSES)[number];

export const EDITABLE_VENUE_APPLICATION_STATUSES = [
  "draft",
  "changes_requested",
] as const satisfies readonly VenueApplicationStatus[];

export const WITHDRAWABLE_VENUE_APPLICATION_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "changes_requested",
] as const satisfies readonly VenueApplicationStatus[];

export const VENUE_APPLICATION_MODES = [
  {
    value: "claim_existing",
    label: "Existing listing claim",
    description:
      "Historical mode. Public claiming is closed; kept for existing applications.",
  },
  {
    value: "create_new",
    label: "Submit your venue details",
    description:
      "Tell us about your venue. We will review the details before publishing.",
  },
] as const;

export type VenueApplicationMode =
  (typeof VENUE_APPLICATION_MODES)[number]["value"];

export const VENUE_RELATIONSHIPS = [
  { value: "owner", label: "I own the venue" },
  { value: "manager", label: "I manage the venue" },
  {
    value: "authorised_representative",
    label: "I am authorised to represent the venue",
  },
] as const;

export type VenueRelationshipValue =
  (typeof VENUE_RELATIONSHIPS)[number]["value"];

export const APPROVED_MEMBERSHIP_ROLES = [
  { value: "owner", label: "Owner" },
  { value: "manager", label: "Manager" },
] as const;

export type ApprovedMembershipRole =
  (typeof APPROVED_MEMBERSHIP_ROLES)[number]["value"];

export const VENUE_APPLICATION_COUNTRIES = [
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

export type VenueApplicationCountry =
  (typeof VENUE_APPLICATION_COUNTRIES)[number];

export const VENUE_APPLICATION_STATUS_LABELS: Record<
  VenueApplicationStatus,
  string
> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  changes_requested: "Changes requested",
  approved: "Approved",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

export function isEditableVenueApplicationStatus(
  status: string
): status is (typeof EDITABLE_VENUE_APPLICATION_STATUSES)[number] {
  return (EDITABLE_VENUE_APPLICATION_STATUSES as readonly string[]).includes(
    status
  );
}

export function isWithdrawableVenueApplicationStatus(
  status: string
): status is (typeof WITHDRAWABLE_VENUE_APPLICATION_STATUSES)[number] {
  return (
    WITHDRAWABLE_VENUE_APPLICATION_STATUSES as readonly string[]
  ).includes(status);
}

export function venueRelationshipLabel(value: string | null): string {
  if (!value) return "Not set";
  return (
    VENUE_RELATIONSHIPS.find((option) => option.value === value)?.label ?? value
  );
}

export function venueApplicationModeLabel(value: string | null): string {
  if (!value) return "Not set";
  return (
    VENUE_APPLICATION_MODES.find((option) => option.value === value)?.label ??
    value
  );
}
