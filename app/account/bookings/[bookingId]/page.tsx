import CoachReviewForm from "@/components/bookings/CoachReviewForm";
import { canReviewBooking, REVIEW_AREAS } from "@/lib/coachReviews";
import { loadMyBookingReview } from "@/lib/queries/coachReviews";
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

  const eligible = canReviewBooking(booking, account.id);
  const reviewState = eligible ? await loadMyBookingReview(bookingId) : null;
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <PlayerBookingDetail
        booking={booking}
        competitorAccepted={competitorAccepted}
      />
      {eligible && reviewState ? (
        <div className="mt-8">
          {!reviewState.available ? <p role="status">Reviews are temporarily unavailable. Please try again later.</p> : reviewState.review ? (
            <section className="rounded-2xl bg-white p-6" aria-labelledby="your-review-heading">
              <h2 id="your-review-heading" className="text-2xl">Your session review</h2>
              <p className="mt-2 text-sm text-primary/70">Thank you for sharing your experience.</p>
              <dl className="mt-4 space-y-2">{REVIEW_AREAS.map((area) => <div className="flex justify-between gap-3 text-sm" key={area.key}><dt>{area.label}</dt><dd>{reviewState.review![area.key]} / 5</dd></div>)}</dl>
              {reviewState.review.body ? <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6">{reviewState.review.body}</p> : null}
            </section>
          ) : <CoachReviewForm bookingId={bookingId} />}
        </div>
      ) : null}
    </div>
  );
}
