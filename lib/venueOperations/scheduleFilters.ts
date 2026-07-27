import type {
  VenueOperationalCalendarSlot,
  VenueScheduleStateFilter,
  VenueScheduleVisibilityFilter,
} from "@/lib/venueOperations/types";

export type VenueScheduleFilterState = {
  coachId: string | "all";
  visibility: VenueScheduleVisibilityFilter;
  /** Default: available + reserved (not requested-only). */
  states: VenueScheduleStateFilter[];
};

export const DEFAULT_SCHEDULE_FILTER: VenueScheduleFilterState = {
  coachId: "all",
  visibility: "all",
  states: ["available", "reserved"],
};

export function filterOperationalSlots(
  slots: VenueOperationalCalendarSlot[],
  filter: VenueScheduleFilterState
): VenueOperationalCalendarSlot[] {
  const stateSet = new Set(filter.states);
  return slots.filter((slot) => {
    if (filter.coachId !== "all" && slot.coachId !== filter.coachId) {
      return false;
    }
    if (filter.visibility === "public" && slot.visibility !== "public") {
      return false;
    }
    if (filter.visibility === "hidden" && slot.visibility !== "hidden") {
      return false;
    }
    return stateSet.has(slot.state);
  });
}

/**
 * Preserve multi-coach identity: same timestamp stays separate per relationship.
 */
export function operationalSlotIdentity(
  slot: Pick<
    VenueOperationalCalendarSlot,
    "relationshipId" | "startsAt" | "endsAt" | "coachId"
  >
): string {
  return `${slot.relationshipId}|${slot.coachId}|${slot.startsAt}|${slot.endsAt}`;
}

export function parseScheduleSearchParams(input: {
  coach?: string | null;
  visibility?: string | null;
  states?: string | null;
}): VenueScheduleFilterState {
  const coachId =
    input.coach && input.coach !== "all" ? input.coach : ("all" as const);
  const visibility =
    input.visibility === "public" || input.visibility === "hidden"
      ? input.visibility
      : ("all" as const);

  let states: VenueScheduleStateFilter[] = ["available", "reserved"];
  if (input.states) {
    const parts = input.states
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean) as VenueScheduleStateFilter[];
    const allowed = parts.filter(
      (p): p is VenueScheduleStateFilter =>
        p === "available" || p === "reserved" || p === "requested"
    );
    if (allowed.length > 0) states = allowed;
  }

  return { coachId, visibility, states };
}
