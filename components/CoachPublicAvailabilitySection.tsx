"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PublicVenueAvailabilityGroup } from "@/lib/coachAvailability/types";
import { formatInTimeZone } from "@/lib/coachAvailability/timezone";
import { PAYMENT_COPY } from "@/lib/coachBookings/constants";

function bookHref(coachId: string, relationshipId: string, startsAt: string) {
  const params = new URLSearchParams({
    relationship: relationshipId,
    start: startsAt,
  });
  return `/book/coach/${encodeURIComponent(coachId)}?${params.toString()}`;
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
    return formatInTimeZone(selected.startsAt, group.timezone, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
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

      <div className="mt-6 space-y-8">
        {groups.map((group) => (
          <div key={group.venueId}>
            <h3 className="text-lg font-semibold text-primary">{group.venueName}</h3>
            <p className="text-sm text-primary/55">
              {[group.city, group.country].filter(Boolean).join(", ")}
              {group.timezone ? ` · ${group.timezone}` : ""}
            </p>
            <ul className="mt-4 space-y-4">
              {group.days.map((day) => (
                <li key={day.date}>
                  <p className="text-sm font-semibold text-primary">{day.label}</p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {day.slots.map((slot) => {
                      const isSelected =
                        selected?.relationshipId === slot.coachVenueId &&
                        selected?.startsAt === slot.startsAt;
                      return (
                        <li key={slot.startsAt}>
                          <button
                            type="button"
                            onClick={() =>
                              setSelected({
                                relationshipId: slot.coachVenueId,
                                startsAt: slot.startsAt,
                                venueName: group.venueName,
                              })
                            }
                            aria-pressed={isSelected}
                            className={`inline-flex rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                              isSelected
                                ? "border-primary bg-primary text-accent"
                                : "border-primary/15 bg-surface text-primary hover:border-primary/30"
                            }`}
                          >
                            {formatInTimeZone(slot.startsAt, slot.timezone, {
                              hour: "2-digit",
                              minute: "2-digit",
                              hourCycle: "h23",
                            })}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
            <Link
              href={`/venue/${group.venueId}`}
              className="mt-3 inline-block text-sm font-semibold text-primary/70 hover:text-primary"
            >
              View venue
            </Link>
          </div>
        ))}
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
