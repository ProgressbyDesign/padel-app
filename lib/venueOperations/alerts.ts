import type {
  CoachAvailabilityHealth,
  VenueAlert,
  VenueOpsSummary,
} from "@/lib/venueOperations/types";

export function buildVenueAlerts(input: {
  venueId: string;
  summary: VenueOpsSummary;
  health: CoachAvailabilityHealth[];
  invitationAwaitingCount: number;
}): VenueAlert[] {
  const base = `/account/venues/${encodeURIComponent(input.venueId)}`;
  const alerts: VenueAlert[] = [];

  if (input.invitationAwaitingCount > 0) {
    alerts.push({
      id: "invitation_awaiting",
      kind: "invitation_awaiting",
      message:
        input.invitationAwaitingCount === 1
          ? "1 coach invitation awaits a response"
          : `${input.invitationAwaitingCount} coach invitations await a response`,
      href: `${base}/coaches`,
    });
  }

  if (input.summary.importedUnverified > 0) {
    alerts.push({
      id: "imported_unverified",
      kind: "imported_unverified",
      message:
        input.summary.importedUnverified === 1
          ? "1 imported relationship needs admin verification"
          : `${input.summary.importedUnverified} imported relationships need admin verification`,
      href: `${base}/coaches`,
    });
  }

  const notConfigured = input.health.filter((h) => h.state === "not_configured");
  if (notConfigured.length > 0) {
    alerts.push({
      id: "not_configured",
      kind: "not_configured",
      message:
        notConfigured.length === 1
          ? "1 coach has no availability settings"
          : `${notConfigured.length} coaches have no availability settings`,
      href: `${base}/coaches`,
    });
  }

  if (input.summary.hiddenSchedules > 0) {
    alerts.push({
      id: "hidden_schedules",
      kind: "hidden_schedules",
      message:
        input.summary.hiddenSchedules === 1
          ? "1 coach has a hidden schedule"
          : `${input.summary.hiddenSchedules} coaches have hidden schedules`,
      href: `${base}/schedule?visibility=hidden`,
    });
  }

  const noFuture = input.health.filter(
    (h) => h.state === "no_future_availability"
  );
  if (noFuture.length > 0) {
    alerts.push({
      id: "no_future_availability",
      kind: "no_future_availability",
      message:
        noFuture.length === 1
          ? "1 coach has no future availability"
          : `${noFuture.length} coaches have no future availability`,
      href: `${base}/coaches`,
    });
  }

  if (input.summary.requestedAwaitingCoach > 0) {
    alerts.push({
      id: "awaiting_coach_response",
      kind: "awaiting_coach_response",
      message:
        input.summary.requestedAwaitingCoach === 1
          ? "1 booking request awaits coach response"
          : `${input.summary.requestedAwaitingCoach} booking requests await coach response`,
      href: `${base}/sessions?tab=awaiting`,
    });
  }

  if (input.summary.noFutureSessions && input.summary.activeCoaches > 0) {
    alerts.push({
      id: "no_future_sessions",
      kind: "no_future_sessions",
      message: "No future sessions are scheduled",
      href: `${base}/sessions`,
    });
  }

  if (input.summary.cancelledNextSevenDays > 0) {
    alerts.push({
      id: "cancelled_this_week",
      kind: "cancelled_this_week",
      message:
        input.summary.cancelledNextSevenDays === 1
          ? "1 accepted session was cancelled this week"
          : `${input.summary.cancelledNextSevenDays} accepted sessions were cancelled this week`,
      href: `${base}/sessions?tab=cancelled`,
    });
  }

  return alerts;
}
