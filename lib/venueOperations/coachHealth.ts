import type {
  CoachAvailabilityHealth,
  CoachAvailabilityHealthState,
} from "@/lib/venueOperations/types";

export type CoachHealthInput = {
  relationshipId: string;
  coachId: string;
  coachName: string;
  coachRole: string | null;
  coachImageUrl: string | null;
  settingsConfigured: boolean;
  isPublic: boolean;
  activeRuleCount: number;
  futureExtraCount: number;
  nextFutureSlotStartsAt: string | null;
  acceptedNext30Days: number;
  requestedAwaitingResponse: number;
  lastScheduleUpdateAt: string | null;
  timezone: string | null;
};

export function resolveCoachHealthState(
  input: Pick<
    CoachHealthInput,
    | "settingsConfigured"
    | "isPublic"
    | "nextFutureSlotStartsAt"
    | "requestedAwaitingResponse"
  >
): CoachAvailabilityHealthState {
  if (!input.settingsConfigured) return "not_configured";
  if (input.requestedAwaitingResponse > 0) return "needs_response";
  if (!input.isPublic) return "hidden";
  if (!input.nextFutureSlotStartsAt) return "no_future_availability";
  return "ready";
}

export function buildCoachAvailabilityHealth(
  input: CoachHealthInput
): CoachAvailabilityHealth {
  return {
    ...input,
    state: resolveCoachHealthState(input),
  };
}

export function coachHealthLabel(state: CoachAvailabilityHealthState): string {
  switch (state) {
    case "ready":
      return "Ready";
    case "hidden":
      return "Hidden from public";
    case "no_future_availability":
      return "No future availability";
    case "not_configured":
      return "Availability not configured";
    case "needs_response":
      return "Needs coach response";
    default:
      return state;
  }
}
