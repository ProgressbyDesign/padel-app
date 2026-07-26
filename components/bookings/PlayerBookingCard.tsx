"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cancelPlayerBookingRequest } from "@/app/account/bookings/actions";
import { ConfirmActionButton } from "@/components/account/RelationshipActionControls";
import {
  formatBookingSessionPrice,
  formatBookingWhen,
  playerStatusLabel,
  statusTone,
} from "@/lib/coachBookings/display";
import type { CoachBookingRequest } from "@/lib/coachBookings/types";

export default function PlayerBookingCard({
  booking,
  competitorAccepted = false,
}: {
  booking: CoachBookingRequest;
  competitorAccepted?: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const canCancel =
    booking.status === "requested" || booking.status === "accepted";
  const confirmLabel =
    booking.status === "accepted"
      ? "Cancel this session? The coach will be notified. Any payment arrangements must be resolved directly with the coach."
      : "Cancel this request?";

  return (
    <li className="rounded-[20px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-primary">
            {booking.coach?.name ?? "Coach"}
          </p>
          <p className="mt-1 text-sm text-primary/65">
            {booking.venue?.name ?? "Venue"} · {formatBookingWhen(booking)} ·{" "}
            {booking.timezone}
          </p>
          <p className="mt-1 text-sm text-primary/55">
            {formatBookingSessionPrice(
              booking.price_amount_minor,
              booking.currency
            )}
          </p>
          <p
            className={`mt-3 inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold ${statusTone(
              booking.status
            )}`}
          >
            {playerStatusLabel(booking, competitorAccepted)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/account/bookings/${booking.id}`}
            className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-semibold text-primary/80 hover:bg-surface"
          >
            View details
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
      </div>
      {canCancel ? (
        <p className="mt-3 text-xs text-primary/45">{confirmLabel}</p>
      ) : null}
      {message ? (
        <p className="mt-2 text-xs text-primary/60" role="status">
          {message}
        </p>
      ) : null}
    </li>
  );
}
