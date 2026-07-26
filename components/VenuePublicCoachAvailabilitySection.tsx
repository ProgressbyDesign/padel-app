"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AvailabilityCalendar, {
  type CalendarSlot,
} from "@/components/availability/AvailabilityCalendar";
import CoachImage from "@/components/CoachImage";
import type { PublicCoachAvailabilityCard } from "@/lib/coachAvailability/types";
import { formatMoney } from "@/lib/coachAvailability/pricing";
import { formatInTimeZone } from "@/lib/coachAvailability/timezone";
import { coachListingProfileHref } from "@/lib/coachListing";

function toCalendarSlots(card: PublicCoachAvailabilityCard): CalendarSlot[] {
  return card.days.flatMap((day) =>
    day.slots.map((slot) => ({
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      timezone: slot.timezone,
      venueId: slot.venueId,
      venueName: slot.venueName,
      priceAmountMinor: slot.priceAmountMinor,
      currency: slot.currency,
    }))
  );
}

export default function VenuePublicCoachAvailabilitySection({
  cards,
}: {
  cards: PublicCoachAvailabilityCard[];
}) {
  const [selected, setSelected] = useState<{
    relationshipId: string;
    startsAt: string;
  } | null>(null);

  const selectedMeta = useMemo(() => {
    if (!selected) return null;
    const card = cards.find((item) => item.relationshipId === selected.relationshipId);
    if (!card) return null;
    const slot = card.days
      .flatMap((day) => day.slots)
      .find((item) => item.startsAt === selected.startsAt);
    const when = formatInTimeZone(selected.startsAt, card.timezone, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const price = slot
      ? formatMoney(slot.priceAmountMinor, slot.currency)
      : null;
    return { when, price };
  }, [cards, selected]);

  if (cards.length === 0) return null;

  return (
    <section className="space-y-2 border-t border-primary/10 pt-8">
      <div>
        <h2 className="text-xl font-semibold text-primary">
          Coaches available at this venue
        </h2>
        <p className="mt-1 text-sm text-primary/70">
          Choose a session time, then send a booking request.
        </p>
      </div>

      <div className="mt-6 space-y-10">
        {cards.map((card) => {
          const next = card.nextSlot;
          const requestStartsAt = selected?.relationshipId === card.relationshipId
            ? selected.startsAt
            : next?.startsAt ?? null;
          const requestHref = requestStartsAt
            ? `/book/coach/${encodeURIComponent(card.coachId)}?${new URLSearchParams(
                {
                  relationship: card.relationshipId,
                  start: requestStartsAt,
                }
              ).toString()}`
            : null;

          return (
            <article
              key={card.relationshipId}
              className="rounded-2xl border border-primary/15 bg-white p-4 sm:p-5"
            >
              <div className="flex gap-4">
                <CoachImage
                  src={card.imageUrl}
                  alt=""
                  className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-xl object-cover object-[center_20%]"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-primary">{card.coachName}</p>
                  {card.role ? (
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-primary/60">
                      {card.role}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-primary/55">{card.timezone}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={coachListingProfileHref(card.coachId, "venues")}
                      className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-semibold text-primary/80 hover:bg-surface"
                    >
                      View availability
                    </Link>
                    {requestHref ? (
                      <Link
                        href={requestHref}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-accent"
                      >
                        Request session
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <AvailabilityCalendar
                  slots={toCalendarSlots(card)}
                  timezone={card.timezone}
                  context="public"
                  selectedStartsAt={
                    selected?.relationshipId === card.relationshipId
                      ? selected.startsAt
                      : null
                  }
                  onSelect={(slot) => {
                    setSelected({
                      relationshipId: card.relationshipId,
                      startsAt: slot.startsAt,
                    });
                  }}
                />
              </div>

              {selected?.relationshipId === card.relationshipId && selectedMeta ? (
                <p className="mt-3 text-sm text-primary/70">
                  Selected:{" "}
                  <span className="font-semibold text-primary">
                    {selectedMeta.when}
                    {selectedMeta.price ? ` · ${selectedMeta.price}` : ""}
                  </span>
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
