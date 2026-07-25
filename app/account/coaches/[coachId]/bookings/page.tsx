import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CoachBookingCard from "@/components/bookings/CoachBookingCard";
import { PAYMENT_COPY } from "@/lib/coachBookings/constants";
import {
  hasAcceptedCompetitor,
  loadCoachBookings,
  partitionCoachBookings,
} from "@/lib/queries/coachBookings";
import { loadCoachAvailabilityAccess } from "@/lib/queries/coachAvailabilityAccess";

export const metadata: Metadata = {
  title: "Booking requests",
  description: "Review and respond to coaching session requests.",
};

type PageProps = {
  params: Promise<{ coachId: string }>;
};

export default async function CoachBookingsPage({ params }: PageProps) {
  const { coachId } = await params;
  const shell = await loadCoachAvailabilityAccess(coachId);
  if (!shell) notFound();

  const bookings = await loadCoachBookings(coachId);
  const { newRequests, upcoming, past } = partitionCoachBookings(bookings);
  // Server render snapshot for completion eligibility.
  // eslint-disable-next-line react-hooks/purity -- intentional request-time clock for UI eligibility
  const nowMs = Date.now();

  const competitorFlags = await Promise.all(
    newRequests.map(async (booking) => ({
      id: booking.id,
      competitor: await hasAcceptedCompetitor(
        booking.coach_id,
        booking.starts_at,
        booking.ends_at,
        booking.id
      ),
    }))
  );
  const competitorById = new Map(
    competitorFlags.map((item) => [item.id, item.competitor])
  );

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-bold text-primary">Booking requests</h2>
        <p className="mt-1 text-sm text-primary/60">
          Review new requests, manage upcoming sessions, and mark completed
          sessions. {PAYMENT_COPY}
        </p>
      </div>

      <section aria-labelledby="new-requests">
        <h3 id="new-requests" className="text-lg font-bold text-primary">
          New requests
        </h3>
        {newRequests.length === 0 ? (
          <p className="mt-3 text-sm text-primary/55">No new requests.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {newRequests.map((booking) => (
              <CoachBookingCard
                key={booking.id}
                booking={booking}
                competitorAccepted={competitorById.get(booking.id) ?? false}
                sessionEnded={new Date(booking.ends_at).getTime() <= nowMs}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="upcoming-sessions">
        <h3 id="upcoming-sessions" className="text-lg font-bold text-primary">
          Upcoming
        </h3>
        {upcoming.length === 0 ? (
          <p className="mt-3 text-sm text-primary/55">
            No accepted upcoming sessions.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {upcoming.map((booking) => (
              <CoachBookingCard
                key={booking.id}
                booking={booking}
                competitorAccepted={false}
                sessionEnded={new Date(booking.ends_at).getTime() <= nowMs}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="past-sessions">
        <h3 id="past-sessions" className="text-lg font-bold text-primary">
          Past
        </h3>
        <p className="mt-1 text-sm text-primary/55">
          Declined, cancelled, completed, and past accepted sessions awaiting
          completion.
        </p>
        {past.length === 0 ? (
          <p className="mt-3 text-sm text-primary/55">No past sessions yet.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {past.map((booking) => (
              <CoachBookingCard
                key={booking.id}
                booking={booking}
                competitorAccepted={false}
                sessionEnded={new Date(booking.ends_at).getTime() <= nowMs}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
