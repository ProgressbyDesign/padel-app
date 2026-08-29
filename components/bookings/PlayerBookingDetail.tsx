"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cancelPlayerBookingRequest } from "@/app/account/bookings/actions";
import { ConfirmActionButton } from "@/components/account/RelationshipActionControls";
import { PAYMENT_COPY } from "@/lib/coachBookings/constants";
import {
  formatBookingDateTime,
  formatBookingSessionPrice,
  playerLevelLabel,
  playerStatusLabel,
  statusTone,
} from "@/lib/coachBookings/display";
import type { CoachBookingRequest } from "@/lib/coachBookings/types";

export default function PlayerBookingDetail({
  booking,
  competitorAccepted,
}: {
  booking: CoachBookingRequest;
  competitorAccepted: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const canCancel =
    booking.status === "requested" || booking.status === "accepted";
  const level = playerLevelLabel(booking.player_level);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
          Booking request
        </p>
        <h1 className="mt-2 text-3xl font-bold text-primary">
          {booking.status === "requested" && !competitorAccepted
            ? "Request sent"
            : "Session details"}
        </h1>
        {booking.status === "requested" && !competitorAccepted ? (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-primary/65">
            The coach will review your request and contact you about
            confirmation and payment.
          </p>
        ) : null}
        {booking.status === "accepted" ? (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-primary/65">
            Your request has been accepted. Contact the coach to confirm payment
            and final arrangements.
          </p>
        ) : null}
      </div>

      <section className="rounded-[24px] border border-primary/10 bg-white p-5 sm:p-6">
        <p
          className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold ${statusTone(
            booking.status
          )}`}
        >
          {playerStatusLabel(booking, competitorAccepted)}
        </p>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-primary/45">Coach</dt>
            <dd className="font-semibold text-primary">
              {booking.coach?.name ?? "Coach"}
            </dd>
          </div>
          <div>
            <dt className="text-primary/45">Venue</dt>
            <dd className="font-semibold text-primary">
              {booking.venue?.name ?? "Venue"}
            </dd>
          </div>
          <div>
            <dt className="text-primary/45">When</dt>
            <dd className="font-semibold text-primary">
              {formatBookingDateTime(booking)}
            </dd>
          </div>
          <div>
            <dt className="text-primary/45">Timezone</dt>
            <dd className="font-semibold text-primary">{booking.timezone}</dd>
          </div>
          <div>
            <dt className="text-primary/45">Price</dt>
            <dd className="font-semibold text-primary">
              {formatBookingSessionPrice(
                booking.price_amount_minor,
                booking.currency
              )}
            </dd>
          </div>
          {level ? (
            <div>
              <dt className="text-primary/45">Player level</dt>
              <dd className="font-semibold text-primary">{level}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-primary/45">Requested</dt>
            <dd className="font-semibold text-primary">
              {new Date(booking.created_at).toLocaleString()}
            </dd>
          </div>
          {booking.responded_at ? (
            <div>
              <dt className="text-primary/45">Responded</dt>
              <dd className="font-semibold text-primary">
                {new Date(booking.responded_at).toLocaleString()}
              </dd>
            </div>
          ) : null}
          {booking.cancelled_at ? (
            <div>
              <dt className="text-primary/45">Cancelled</dt>
              <dd className="font-semibold text-primary">
                {new Date(booking.cancelled_at).toLocaleString()}
              </dd>
            </div>
          ) : null}
          {booking.completed_at ? (
            <div>
              <dt className="text-primary/45">Completed</dt>
              <dd className="font-semibold text-primary">
                {new Date(booking.completed_at).toLocaleString()}
              </dd>
            </div>
          ) : null}
        </dl>
        {booking.message ? (
          <div className="mt-5 border-t border-primary/10 pt-5">
            <p className="text-sm text-primary/45">Your message</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-primary">
              {booking.message}
            </p>
          </div>
        ) : null}
        <p className="mt-5 text-sm text-primary/60">{PAYMENT_COPY}</p>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/account/bookings"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent"
        >
          View my requests
        </Link>
        <Link
          href={`/coach/${booking.coach_id}`}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/15 px-5 py-2.5 text-sm font-semibold text-primary/70"
        >
          Return to coach profile
        </Link>
        {canCancel ? (
          <ConfirmActionButton
            label="Cancel"
            confirmLabel="Confirm cancel"
            onConfirm={async () => {
              const result = await cancelPlayerBookingRequest(booking.id);
              setMessage(result.message);
              if (result.ok) router.refresh();
              return result;
            }}
          />
        ) : null}
      </div>
      {canCancel ? (
        <p className="text-xs text-primary/45">
          {booking.status === "accepted"
            ? "Cancel this session? The coach will be notified. Any payment arrangements must be resolved directly with the coach."
            : "Cancel this request?"}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-primary/60" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
