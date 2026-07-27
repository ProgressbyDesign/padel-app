export const ACCOUNT_DELETION_STATUSES = [
  "requested",
  "processing",
  "completed",
  "declined",
  "cancelled",
] as const;

export type AccountDeletionStatus =
  (typeof ACCOUNT_DELETION_STATUSES)[number];

export const ACCOUNT_DELETION_STATUS_LABELS: Record<
  AccountDeletionStatus,
  string
> = {
  requested: "Pending review",
  processing: "In progress",
  completed: "Account deletion completed",
  declined: "Request could not be completed",
  cancelled: "Cancelled",
};

export const ACTIVE_OPEN = [
  "requested",
  "processing",
] as const satisfies readonly AccountDeletionStatus[];

export const ACTIVE_OPEN_DELETION_STATUSES = ACTIVE_OPEN;

export type ActiveOpenDeletionStatus = (typeof ACTIVE_OPEN)[number];

export function isAccountDeletionStatus(
  value: string
): value is AccountDeletionStatus {
  return (ACCOUNT_DELETION_STATUSES as readonly string[]).includes(value);
}

export function isActiveOpenDeletionStatus(
  value: string
): value is ActiveOpenDeletionStatus {
  return (ACTIVE_OPEN as readonly string[]).includes(value);
}

export const DELETION_CONFIRMATION_TEXT = "DELETE";

export const DELETION_REASON_MAX_LENGTH = 1000;

export type AccountDeletionRequest = {
  id: string;
  user_id: string;
  requester_email: string;
  status: AccountDeletionStatus;
  reason: string | null;
  requested_at: string;
  cancelled_at: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DeletionResponsibilitySummary = {
  coachCount: number;
  venueCount: number;
  futurePlayerBookings: number;
  coachPendingBookings: number;
};

export type DeletionActionResult = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
  requestId?: string;
};

export type AdminDeletionCoachSummary = {
  id: string;
  name: string;
  membershipRole: string | null;
};

export type AdminDeletionVenueSummary = {
  id: string;
  name: string;
  membershipRole: string | null;
};

export type AdminDeletionRequestDetail = {
  request: AccountDeletionRequest;
  profileName: string | null;
  coaches: AdminDeletionCoachSummary[];
  venues: AdminDeletionVenueSummary[];
  applicationCounts: {
    coach: number;
    venue: number;
  };
  relationshipCounts: {
    coach: number;
    venue: number;
  };
  bookingCounts: {
    futurePlayer: number;
    coachPending: number;
  };
  hasAccountAvatar: boolean;
};
