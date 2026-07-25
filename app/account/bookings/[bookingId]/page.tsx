import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PlayerBookingDetail from "@/components/bookings/PlayerBookingDetail";
import { requireAuthenticatedAccount } from "@/lib/auth/session";
import {
  hasAcceptedCompetitor,
  loadBookingById,
} from "@/lib/queries/coachBookings";

export const metadata: Metadata = {
  title: "Booking details",
  description: "Your coaching session request details.",
};

type PageProps = {
  params: Promise<{ bookingId: string }>;
};

export default async function PlayerBookingDetailPage({ params }: PageProps) {
  const { bookingId } = await params;
  const account = await requireAuthenticatedAccount(
    `/account/bookings/${encodeURIComponent(bookingId)}`
  );

  const booking = await loadBookingById(bookingId);
  if (!booking || booking.requester_user_id !== account.id) {
    notFound();
  }

  const competitorAccepted =
    booking.status === "requested"
      ? await hasAcceptedCompetitor(
          booking.coach_id,
          booking.starts_at,
          booking.ends_at,
          booking.id
        )
      : false;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14 lg:px-[120px]">
      <PlayerBookingDetail
        booking={booking}
        competitorAccepted={competitorAccepted}
      />
    </div>
  );
}
