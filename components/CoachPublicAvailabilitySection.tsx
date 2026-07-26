"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AvailabilityCalendar, {
  type CalendarSlot,
} from "@/components/availability/AvailabilityCalendar";
import type { PublicVenueAvailabilityGroup } from "@/lib/coachAvailability/types";
import { formatMoney } from "@/lib/coachAvailability/pricing";
import { formatInTimeZone } from "@/lib/coachAvailability/timezone";
import { PAYMENT_COPY } from "@/lib/coachBookings/constants";

function bookHref(coachId: string, relationshipId: string, startsAt: string) {
  const params = new URLSearchParams({
    relationship: relationshipId,
    start: startsAt,
  });
  return `/book/coach/${encodeURIComponent(coachId)}?${params.toString()}`;
}

function toCalendarSlots(
  group: PublicVenueAvailabilityGroup
): CalendarSlot[] {
  return group.days.flatMap((day) =>
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

export default function CoachPublicAvailabilitySection({
  coachId,
  groups,
}: {
  coachId: string;
  groups: PublicVenueAvailabilityGroup[];
}) {
  const [selected, setSelected] = useState<{
    relationshipId: string;
    startsAt: string;
    venueName: string;
  } | null>(null);

  const selectedLabel = useMemo(() => {
    if (!selected) return null;
    const group = groups.find((item) =>
      item.days.some((day) =>
        day.slots.some(
          (slot) =>
            slot.coachVenueId === selected.relationshipId &&
            slot.startsAt === selected.startsAt
        )
      )
    );
    if (!group) return null;
    const slot = group.days
      .flatMap((day) => day.slots)
      .find(
        (item) =>
          item.coachVenueId === selected.relationshipId &&
          item.startsAt === selected.startsAt
      );
    const when = formatInTimeZone(selected.startsAt, group.timezone, {
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
    return price ? `${when} · ${price}` : when;
  }, [groups, selected]);

  if (groups.length === 0) return null;

  return (
    <section className="mt-10 border-t border-primary/10 pt-10" aria-labelledby="availability-heading">
      <h2 id="availability-heading" className="text-xl font-semibold text-primary">
        Available coaching sessions
      </h2>
      <p className="mt-1 text-sm text-primary/65">
        Choose a time, then send a booking request. {PAYMENT_COPY}
      </p>

      <div className="mt-6 space-y-10">
        {groups.map((group) => {
          const relationshipId = group.days[0]?.slots[0]?.coachVenueId;
          return (
            <div key={group.venueId}>
              <h3 className="text-lg font-semibold text-primary">{group.venueName}</h3>
              <p className="text-sm text-primary/55">
                {[group.city, group.country].filter(Boolean).join(", ")}
                {group.timezone ? ` · ${group.timezone}` : ""}
              </p>
              <div className="mt-4">
                <AvailabilityCalendar
                  slots={toCalendarSlots(group)}
                  timezone={group.timezone}
                  context="public"
                  selectedStartsAt={
                    selected?.relationshipId === relationshipId
                      ? selected.startsAt
                      : null
                  }
                  onSelect={(slot) => {
                    const match = group.days
                      .flatMap((day) => day.slots)
                      .find((item) => item.startsAt === slot.startsAt);
                    if (!match) return;
                    setSelected({
                      relationshipId: match.coachVenueId,
                      startsAt: match.startsAt,
                      venueName: group.venueName,
                    });
                  }}
                />
              </div>
              <Link
                href={`/venue/${group.venueId}`}
                className="mt-3 inline-block text-sm font-semibold text-primary/70 hover:text-primary"
              >
                View venue
              </Link>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-primary/10 bg-surface/60 p-4">
        {selected ? (
          <p className="text-sm text-primary/70">
            Selected:{" "}
            <span className="font-semibold text-primary">
              {selected.venueName} · {selectedLabel}
            </span>
          </p>
        ) : (
          <p className="text-sm text-primary/55">Select a session time to continue.</p>
        )}
        {selected ? (
          <Link
            href={bookHref(coachId, selected.relationshipId, selected.startsAt)}
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
    </section>
  );
}
