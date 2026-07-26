"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  calendarSlotKey,
  type CalendarSlot,
} from "@/components/availability/AvailabilityCalendar";
import VenueAvailabilityCalendar from "@/components/availability/VenueAvailabilityCalendar";
import type { PublicCoachAvailabilityCard } from "@/lib/coachAvailability/types";
import { formatMoney } from "@/lib/coachAvailability/pricing";
import { formatInTimeZone } from "@/lib/coachAvailability/timezone";

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
        relationshipId: card.relationshipId,
      }))
    )
  );
}

function bookHref(coachId: string, relationshipId: string, startsAt: string) {
  const params = new URLSearchParams({
    relationship: relationshipId,
    start: startsAt,
  });
  return `/book/coach/${encodeURIComponent(coachId)}?${params.toString()}`;
}

export default function VenuePublicCoachAvailabilitySection({
  cards,
  hasCoaches = false,
}: {
  cards: PublicCoachAvailabilityCard[];
  hasCoaches?: boolean;
}) {
  const slots = useMemo(() => cardsToCalendarSlots(cards), [cards]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<CalendarSlot | null>(null);

  const selectedSummary = useMemo(() => {
    if (!selectedSlot) return null;
    const when = formatInTimeZone(selectedSlot.startsAt, selectedSlot.timezone, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const price = formatMoney(
      selectedSlot.priceAmountMinor,
      selectedSlot.currency
    );
    return {
      coachName: selectedSlot.coachName ?? "Coach",
      when,
      price,
    };
  }, [selectedSlot]);

  if (!hasCoaches && cards.length === 0) return null;

  const requestHref =
    selectedSlot?.coachId && selectedSlot.relationshipId
      ? bookHref(
          selectedSlot.coachId,
          selectedSlot.relationshipId,
          selectedSlot.startsAt
        )
      : null;

  return (
    <section className="space-y-2 border-t border-primary/10 pt-8">
      <div>
        <h2 className="text-xl font-semibold text-primary">
          Available sessions at this venue
        </h2>
        <p className="mt-1 text-sm text-primary/70">
          Choose a session time, then send a booking request.
        </p>
      </div>

      {slots.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-primary/10 bg-surface/50 px-4 py-8 text-center text-sm text-primary/55">
          No coaches are currently offering bookable sessions at this venue.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          <VenueAvailabilityCalendar
            slots={slots}
            context="public"
            selectedKey={selectedKey}
            onSelectedKeyChange={setSelectedKey}
            onSelect={(slot) => {
              setSelectedKey(calendarSlotKey(slot));
              setSelectedSlot(slot);
            }}
            emptyMessage="No sessions are available this week."
          />

          <div className="rounded-2xl border border-primary/10 bg-surface/60 p-4">
            {selectedSummary ? (
              <p className="text-sm text-primary/70">
                Selected:{" "}
                <span className="font-semibold text-primary">
                  {selectedSummary.coachName} · {selectedSummary.when}
                  {selectedSummary.price ? ` · ${selectedSummary.price}` : ""}
                </span>
              </p>
            ) : (
              <p className="text-sm text-primary/55">
                Select a session time to continue.
              </p>
            )}
            {requestHref ? (
              <Link
                href={requestHref}
                className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent"
              >
                Request session
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl border border-primary/15 px-4 py-2 text-sm font-semibold text-primary/45"
              >
                Request session
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
