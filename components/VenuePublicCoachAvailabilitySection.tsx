"use client";

import { useMemo } from "react";
import VenueAvailabilityCalendar from "@/components/availability/VenueAvailabilityCalendar";
import type { CalendarSlot } from "@/components/availability/AvailabilityCalendar";
import type { PublicCoachAvailabilityCard } from "@/lib/coachAvailability/types";
import { durationMinutesFromRange } from "@/lib/coachAvailability/venueTimeGroups";

function cardsToCalendarSlots(
  cards: PublicCoachAvailabilityCard[]
): CalendarSlot[] {
  return cards.flatMap((card) =>
    card.days.flatMap((day) =>
      day.slots.map((slot) => ({
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        timezone: slot.timezone,
        venueId: slot.venueId,
        venueName: slot.venueName,
        priceAmountMinor: slot.priceAmountMinor,
        currency: slot.currency,
        coachId: card.coachId,
        coachName: card.coachName,
        coachImageUrl: card.imageUrl,
        coachRole: card.role,
        relationshipId: card.relationshipId,
        durationMinutes: durationMinutesFromRange(slot.startsAt, slot.endsAt),
        visibility: "public" as const,
      }))
    )
  );
}

export default function VenuePublicCoachAvailabilitySection({
  cards,
  hasCoaches = false,
}: {
  cards: PublicCoachAvailabilityCard[];
  hasCoaches?: boolean;
}) {
  const slots = useMemo(() => cardsToCalendarSlots(cards), [cards]);

  if (!hasCoaches && cards.length === 0) return null;

  return (
    <section className="space-y-2 border-t border-primary/10 pt-8">
      <div>
        <h2 className="text-xl font-semibold text-primary">
          Available sessions at this venue
        </h2>
        <p className="mt-1 text-sm text-primary/70">
          Choose a time, then pick a coach to request a session.
        </p>
      </div>

      {slots.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-primary/10 bg-surface/50 px-4 py-8 text-center text-sm text-primary/55">
          {hasCoaches
            ? "No coaches currently have public sessions available at this venue."
            : "No coaches are currently offering bookable sessions at this venue."}
        </p>
      ) : (
        <div className="mt-6">
          <VenueAvailabilityCalendar
            slots={slots}
            context="public"
            emptyMessage="No sessions are available this week."
          />
        </div>
      )}
    </section>
  );
}
