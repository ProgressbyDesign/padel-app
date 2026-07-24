export const COACH_VENUE_STATUSES = [
  "unverified",
  "pending",
  "active",
  "declined",
  "cancelled",
  "ended",
] as const;

export type CoachVenueStatus = (typeof COACH_VENUE_STATUSES)[number];

export const COACH_VENUE_INITIATORS = [
  "coach",
  "venue",
  "admin",
  "import",
] as const;

export type CoachVenueInitiator = (typeof COACH_VENUE_INITIATORS)[number];

/** Relationships that block a new coach↔venue pair. */
export const CURRENT_COACH_VENUE_STATUSES = [
  "unverified",
  "pending",
  "active",
] as const satisfies readonly CoachVenueStatus[];

export type CurrentCoachVenueStatus =
  (typeof CURRENT_COACH_VENUE_STATUSES)[number];

export const PAST_COACH_VENUE_STATUSES = [
  "declined",
  "cancelled",
  "ended",
] as const satisfies readonly CoachVenueStatus[];

/** Public profiles show confirmed + imported (compatibility). */
export const PUBLIC_COACH_VENUE_STATUSES = [
  "active",
  "unverified",
] as const satisfies readonly CoachVenueStatus[];

export const COACH_VENUE_STATUS_LABELS: Record<CoachVenueStatus, string> = {
  unverified: "Imported — awaiting verification",
  pending: "Pending",
  active: "Active",
  declined: "Declined",
  cancelled: "Cancelled",
  ended: "Ended",
};

export const COACH_VENUE_INITIATOR_LABELS: Record<CoachVenueInitiator, string> = {
  coach: "Coach",
  venue: "Venue",
  admin: "Admin",
  import: "Import",
};

export function isCoachVenueStatus(value: string): value is CoachVenueStatus {
  return (COACH_VENUE_STATUSES as readonly string[]).includes(value);
}

export function isCurrentCoachVenueStatus(
  value: string
): value is CurrentCoachVenueStatus {
  return (CURRENT_COACH_VENUE_STATUSES as readonly string[]).includes(value);
}

export function isPastCoachVenueStatus(value: string): boolean {
  return (PAST_COACH_VENUE_STATUSES as readonly string[]).includes(value);
}
