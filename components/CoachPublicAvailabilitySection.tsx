"use client";

import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import VenueAvailabilityCalendar from "@/components/availability/VenueAvailabilityCalendar";
import type { PublicVenueAvailabilityGroup } from "@/lib/coachAvailability/types";
import { PAYMENT_COPY } from "@/lib/coachBookings/constants";

export default function CoachPublicAvailabilitySection({ coachId, coachName = "Coach", groups }: {
  coachId: string;
  coachName?: string;
  groups: PublicVenueAvailabilityGroup[];
}) {
  return (
    <section id="coach-availability" className="mt-12 scroll-mt-24 rounded-[24px] border border-primary/15 bg-white p-4 sm:p-8 lg:p-10" aria-labelledby="availability-heading">
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-primary/15 pb-6">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/60">Your next session starts here</p>
          <h2 id="availability-heading" className="mt-3 text-3xl">Let&apos;s get on court</h2>
          <p className="mt-3 text-sm leading-6 text-primary/75">Choose a time to see the session details and send a booking request.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-xs font-semibold"><CalendarDays className="h-4 w-4" aria-hidden />Upcoming availability</span>
      </div>
      {groups.length === 0 ? (
        <div className="py-8">
          <h3 className="text-xl">No sessions currently listed</h3>
          <p className="mt-3 text-sm text-primary/70">Check back for new availability, or explore other coaches.</p>
          <Link href="/coaches" className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold underline">Explore coaches</Link>
        </div>
      ) : (
        <div className="mt-6 space-y-10">
          {groups.map((group) => (
            <div key={group.venueId}>
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl">{group.venueName}</h3>
                  <p className="mt-2 flex gap-1.5 text-sm text-primary/70"><MapPin className="h-4 w-4 shrink-0" aria-hidden />{[group.city, group.country].filter(Boolean).join(", ") || group.venueName}</p>
                </div>
                <Link href={`/venue/${group.venueId}`} className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">View venue</Link>
              </div>
              <VenueAvailabilityCalendar
                context="public"
                slots={group.days.flatMap((day) => day.slots.map((slot) => ({
                  ...slot,
                  coachId,
                  coachName,
                  relationshipId: slot.coachVenueId,
                  visibility: "public" as const,
                })))}
                emptyMessage="No sessions are available this week."
              />
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs leading-5 text-primary/65">{PAYMENT_COPY}</p>
    </section>
  );
}
