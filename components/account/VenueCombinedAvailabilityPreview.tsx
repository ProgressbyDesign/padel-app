"use client";

import type { CalendarSlot } from "@/components/availability/AvailabilityCalendar";
import VenueAvailabilityCalendar from "@/components/availability/VenueAvailabilityCalendar";
import type { VenueCombinedAvailabilityPreviewSlot } from "@/lib/coachAvailability/types";

export default function VenueCombinedAvailabilityPreview({
  slots,
  hasActiveCoaches,
}: {
  slots: VenueCombinedAvailabilityPreviewSlot[];
  hasActiveCoaches: boolean;
}) {
  const calendarSlots: CalendarSlot[] = slots.map((slot) => ({
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    timezone: slot.timezone,
    venueId: slot.venueId,
    venueName: slot.venueName,
    priceAmountMinor: slot.priceAmountMinor,
    currency: slot.currency,
    state: slot.state,
    visibility: slot.visibility,
    coachId: slot.coachId,
    coachName: slot.coachName,
    coachRole: slot.coachRole,
    coachImageUrl: slot.coachImageUrl,
    relationshipId: slot.relationshipId,
    durationMinutes: slot.durationMinutes,
  }));

  const hasHidden = slots.some((slot) => slot.visibility === "hidden");

  return (
    <section className="space-y-3 rounded-[24px] border border-primary/10 bg-white p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-bold text-primary">
          Available sessions at this venue
        </h2>
        <p className="mt-1 text-sm text-primary/60">
          Combined schedule for active coaches. Public pages only show public
          schedules. Reserved slots are booked — requester details are not shown.
        </p>
        {hasHidden ? (
          <p className="mt-2 text-sm text-amber-900/80">
            Some schedules are configured but hidden from the public venue
            calendar.
          </p>
        ) : null}
      </div>

      {!hasActiveCoaches ? (
        <p className="rounded-2xl border border-primary/10 bg-surface/50 px-4 py-8 text-center text-sm text-primary/55">
          No coaches are currently linked to this venue.
        </p>
      ) : calendarSlots.length === 0 ? (
        <p className="rounded-2xl border border-primary/10 bg-surface/50 px-4 py-8 text-center text-sm text-primary/55">
          No sessions are available this week.
        </p>
      ) : (
        <VenueAvailabilityCalendar
          slots={calendarSlots}
          context="venue_preview"
          emptyMessage="No sessions are available this week."
        />
      )}
    </section>
  );
}
