"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  acceptCoachBookingRequest,
  cancelCoachBookingRequest,
  completeCoachBookingRequest,
  declineCoachBookingRequest,
} from "@/app/account/bookings/actions";
import {
  ActionButton,
  ConfirmActionButton,
} from "@/components/account/RelationshipActionControls";
import {
  formatBookingWhen,
  playerLevelLabel,
  statusTone,
} from "@/lib/coachBookings/display";
import { BOOKING_STATUS_LABELS } from "@/lib/coachBookings/constants";
import type { CoachBookingRequest } from "@/lib/coachBookings/types";

export default function CoachBookingCard({
  booking,
  competitorAccepted,
  sessionEnded,
}: {
  booking: CoachBookingRequest;
  competitorAccepted: boolean;
  sessionEnded: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const level = playerLevelLabel(booking.player_level);
  const canAccept = booking.status === "requested" && !competitorAccepted;
  const canDecline = booking.status === "requested";
  const canCancel =
    booking.status === "requested" || booking.status === "accepted";
  const canComplete = booking.status === "accepted" && sessionEnded;

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action();
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <li className="rounded-[20px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)]">
      <div className="min-w-0">
        <p className="font-semibold text-primary">{booking.requester_name}</p>
        <p className="mt-1 text-sm text-primary/65">{booking.requester_email}</p>
        {booking.requester_phone ? (
          <p className="text-sm text-primary/65">{booking.requester_phone}</p>
        ) : null}
        {level ? (
          <p className="mt-1 text-sm text-primary/55">Level: {level}</p>
        ) : null}
        <p className="mt-3 text-sm text-primary/70">
          {booking.venue?.name ?? "Venue"} · {formatBookingWhen(booking)} ·{" "}
          {booking.timezone}
        </p>
        <p className="mt-1 text-xs text-primary/45">
          Requested {new Date(booking.created_at).toLocaleString()}
        </p>
        <p
          className={`mt-3 inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold ${statusTone(
            booking.status
          )}`}
        >
          {BOOKING_STATUS_LABELS[booking.status]}
        </p>
        {competitorAccepted && booking.status === "requested" ? (
          <p className="mt-2 text-sm font-medium text-amber-900">
            Another request has already been accepted for this time.
          </p>
        ) : null}
      </div>

      {booking.message ? (
        <p className="mt-4 whitespace-pre-wrap rounded-xl bg-surface/70 p-3 text-sm leading-6 text-primary/80">
          {booking.message}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {canAccept ? (
          <ActionButton
            pending={pending}
            onClick={() => run(() => acceptCoachBookingRequest(booking.id))}
          >
            Accept
          </ActionButton>
        ) : null}
        {canDecline ? (
          <ConfirmActionButton
            label="Decline"
            confirmLabel="Confirm decline"
            onConfirm={async () => {
              const result = await declineCoachBookingRequest(booking.id);
              setMessage(result.message);
              if (result.ok) router.refresh();
              return result;
            }}
          />
        ) : null}
        {canCancel ? (
          <ConfirmActionButton
            label="Cancel"
            confirmLabel="Confirm cancel"
            onConfirm={async () => {
              const result = await cancelCoachBookingRequest(booking.id);
              setMessage(result.message);
              if (result.ok) router.refresh();
              return result;
            }}
          />
        ) : null}
        {canComplete ? (
          <ConfirmActionButton
            label="Mark complete"
            confirmLabel="Confirm complete"
            tone="neutral"
            onConfirm={async () => {
              const result = await completeCoachBookingRequest(booking.id);
              setMessage(result.message);
              if (result.ok) router.refresh();
              return result;
            }}
          />
        ) : null}
      </div>
      {canCancel ? (
        <p className="mt-2 text-xs text-primary/45">
          Cancel this session? The player will be notified.
        </p>
      ) : null}
      {message ? (
        <p className="mt-2 text-xs text-primary/60" role="status">
          {message}
        </p>
      ) : null}
    </li>
  );
}
