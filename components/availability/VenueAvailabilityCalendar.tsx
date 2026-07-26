"use client";

import { useMemo, useState } from "react";
import AvailabilityCalendar, {
  calendarSlotKey,
  type CalendarContext,
  type CalendarSlot,
} from "@/components/availability/AvailabilityCalendar";

type Props = {
  slots: CalendarSlot[];
  /** Venue-dominant timezone override; otherwise most common slot timezone or first. */
  timezone?: string;
  context: Extract<CalendarContext, "public" | "venue_preview">;
  selectedKey?: string | null;
  onSelect?: (slot: CalendarSlot) => void;
  onSelectedKeyChange?: (key: string | null) => void;
  selectable?: boolean;
  emptyMessage?: string;
  numberOfDays?: number;
};

function dominantTimezone(slots: CalendarSlot[], fallback?: string): string {
  if (fallback) return fallback;
  if (slots.length === 0) return "UTC";
  const counts = new Map<string, number>();
  for (const slot of slots) {
    counts.set(slot.timezone, (counts.get(slot.timezone) ?? 0) + 1);
  }
  let best = slots[0]!.timezone;
  let bestCount = 0;
  for (const [tz, count] of counts) {
    if (count > bestCount) {
      best = tz;
      bestCount = count;
    }
  }
  return best;
}

type CoachOption = {
  coachId: string;
  coachName: string;
};

export default function VenueAvailabilityCalendar({
  slots,
  timezone: timezoneProp,
  context,
  selectedKey: controlledSelectedKey,
  onSelect,
  onSelectedKeyChange,
  selectable = context === "public",
  emptyMessage,
  numberOfDays = 7,
}: Props) {
  const [coachFilter, setCoachFilter] = useState<string>("all");
  const [uncontrolledSelectedKey, setUncontrolledSelectedKey] = useState<
    string | null
  >(null);

  const selectedKey =
    controlledSelectedKey !== undefined
      ? controlledSelectedKey
      : uncontrolledSelectedKey;

  const timezone = useMemo(
    () => dominantTimezone(slots, timezoneProp),
    [slots, timezoneProp]
  );

  const coaches = useMemo((): CoachOption[] => {
    const map = new Map<string, string>();
    for (const slot of slots) {
      if (!slot.coachId) continue;
      if (!map.has(slot.coachId)) {
        map.set(slot.coachId, slot.coachName ?? "Coach");
      }
    }
    return [...map.entries()]
      .map(([coachId, coachName]) => ({ coachId, coachName }))
      .sort((a, b) => a.coachName.localeCompare(b.coachName));
  }, [slots]);

  const filteredSlots = useMemo(() => {
    if (coachFilter === "all") return slots;
    return slots.filter((slot) => slot.coachId === coachFilter);
  }, [slots, coachFilter]);

  function setSelectedKey(next: string | null) {
    if (controlledSelectedKey === undefined) {
      setUncontrolledSelectedKey(next);
    }
    onSelectedKeyChange?.(next);
  }

  function handleSelect(slot: CalendarSlot) {
    const key = calendarSlotKey(slot);
    setSelectedKey(key);
    onSelect?.(slot);
  }

  return (
    <div className="space-y-4">
      {coaches.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="venue-availability-coach-filter"
            className="text-xs font-semibold uppercase tracking-wide text-primary/55"
          >
            Coach
          </label>
          <select
            id="venue-availability-coach-filter"
            value={coachFilter}
            onChange={(event) => setCoachFilter(event.target.value)}
            className="rounded-xl border border-primary/15 bg-white px-3 py-2 text-sm font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <option value="all">All coaches</option>
            {coaches.map((coach) => (
              <option key={coach.coachId} value={coach.coachId}>
                {coach.coachName}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <AvailabilityCalendar
        slots={filteredSlots}
        timezone={timezone}
        context={context}
        selectedKey={selectedKey}
        onSelect={handleSelect}
        selectable={selectable}
        emptyMessage={emptyMessage}
        numberOfDays={numberOfDays}
      />
    </div>
  );
}
