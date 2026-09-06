import type { Metadata } from "next";
import Link from "next/link";
import PlayerBookingCard from "@/components/bookings/PlayerBookingCard";
import { requireAuthenticatedAccount } from "@/lib/auth/session";
import {
  hasAcceptedCompetitor,
  loadPlayerBookings,
  partitionPlayerBookings,
} from "@/lib/queries/coachBookings";

export const metadata: Metadata = {
  title: "My bookings",
  description: "Your coaching session requests.",
};

export default async function PlayerBookingsPage() {
  const account = await requireAuthenticatedAccount("/account/bookings");
  const bookings = await loadPlayerBookings(account.id);
  const { upcoming, past } = partitionPlayerBookings(bookings);

  const competitorFlags = await Promise.all(
    upcoming
      .filter((b) => b.status === "requested")
      .map(async (booking) => ({
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
    <div className="mx-auto w-full max-w-[1680px] px-4 py-10 sm:px-6 sm:py-14 lg:px-[120px]">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
          Account
        </p>
        <h1 className="mt-3 text-3xl text-primary sm:text-4xl">
          Bookings
        </h1>
        <p className="mt-3 text-base leading-6 text-primary/65">
          Track coaching session requests and accepted sessions.
        </p>
      </div>

      <section className="mt-10" aria-labelledby="upcoming-bookings">
        <h2 id="upcoming-bookings" className="text-2xl text-primary">
          Upcoming
        </h2>
        {upcoming.length === 0 ? (
          <p className="mt-4 text-sm text-primary/55">
            No upcoming requests. Browse coaches to find a session.
          </p>
        ) : (
          <ul className="mt-5 space-y-4">
            {upcoming.map((booking) => (
              <PlayerBookingCard
                key={booking.id}
                booking={booking}
                competitorAccepted={competitorById.get(booking.id) ?? false}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12" aria-labelledby="past-bookings">
        <h2 id="past-bookings" className="text-2xl text-primary">
          Past
        </h2>
        <p className="mt-1 text-sm text-primary/55">
          Declined, cancelled, completed, and sessions whose time has passed.
        </p>
        {past.length === 0 ? (
          <p className="mt-4 text-sm text-primary/55">No past bookings yet.</p>
        ) : (
          <ul className="mt-5 space-y-4">
            {past.map((booking) => (
              <PlayerBookingCard key={booking.id} booking={booking} />
            ))}
          </ul>
        )}
      </section>

      <p className="mt-10">
        <Link
          href="/account"
          className="text-sm font-semibold text-primary/70 hover:text-primary"
        >
          Back to account
        </Link>
      </p>
    </div>
  );
}
