"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
  BOOKING_STATUS_LABELS,
  BOOKING_STATUSES,
} from "@/lib/coachBookings/constants";
import {
  formatBookingWhen,
  statusTone,
} from "@/lib/coachBookings/display";
import type { CoachBookingRequest } from "@/lib/coachBookings/types";

export default function AdminBookingsPanel({
  rows,
  initialStatus,
  initialCoach,
  initialVenue,
  initialRequester,
  initialDate,
  nowMs,
}: {
  rows: CoachBookingRequest[];
  initialStatus: string | null;
  initialCoach: string | null;
  initialVenue: string | null;
  initialRequester: string | null;
  initialDate: string | null;
  nowMs: number;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <form
        className="grid gap-3 rounded-2xl border border-primary/10 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
        method="get"
      >
        <label className="text-xs font-semibold text-primary/60">
          Status
          <select
            name="status"
            defaultValue={initialStatus ?? ""}
            className="mt-1 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {BOOKING_STATUSES.map((status) => (
              <option key={status} value={status}>
                {BOOKING_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-primary/60">
          Coach
          <input
            name="coach"
            defaultValue={initialCoach ?? ""}
            placeholder="Name contains…"
            className="mt-1 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-semibold text-primary/60">
          Venue
          <input
            name="venue"
            defaultValue={initialVenue ?? ""}
            placeholder="Name contains…"
            className="mt-1 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-semibold text-primary/60">
          Requester
          <input
            name="requester"
            defaultValue={initialRequester ?? ""}
            placeholder="Name or email…"
            className="mt-1 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-semibold text-primary/60">
          Date
          <input
            type="date"
            name="date"
            defaultValue={initialDate ?? ""}
            className="mt-1 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2 text-sm"
          />
        </label>
        <div className="sm:col-span-2 lg:col-span-5">
          <button
            type="submit"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent"
          >
            Apply filters
          </button>
        </div>
      </form>

      {message ? (
        <p className="text-sm text-primary/65" role="status">
          {message}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-primary/55">No bookings match these filters.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((booking) => {
            const ended = new Date(booking.ends_at).getTime() <= nowMs;
            const canAccept = booking.status === "requested";
            const canDecline = booking.status === "requested";
            const canCancel =
              booking.status === "requested" || booking.status === "accepted";
            const canComplete = booking.status === "accepted" && ended;

            return (
              <li
                key={booking.id}
                className="rounded-2xl border border-primary/10 bg-white p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-primary">
                      {booking.coach?.name ?? "Coach"} ·{" "}
                      {booking.venue?.name ?? "Venue"}
                    </p>
                    <p className="mt-1 text-sm text-primary/65">
                      {booking.requester_name} · {booking.requester_email}
                    </p>
                    <p className="mt-1 text-sm text-primary/70">
                      {formatBookingWhen(booking)} · {booking.timezone}
                    </p>
                    <p
                      className={`mt-3 inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold ${statusTone(
                        booking.status
                      )}`}
                    >
                      {BOOKING_STATUS_LABELS[booking.status]}
                    </p>
                    <p className="mt-2 text-xs text-primary/45">
                      Created {new Date(booking.created_at).toLocaleString()}
                      {booking.responded_at
                        ? ` · Responded ${new Date(
                            booking.responded_at
                          ).toLocaleString()}`
                        : ""}
                      {booking.cancelled_at
                        ? ` · Cancelled ${new Date(
                            booking.cancelled_at
                          ).toLocaleString()}`
                        : ""}
                      {booking.completed_at
                        ? ` · Completed ${new Date(
                            booking.completed_at
                          ).toLocaleString()}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canAccept ? (
                      <ActionButton
                        onClick={() => {
                          void (async () => {
                            const result = await acceptCoachBookingRequest(
                              booking.id
                            );
                            setMessage(result.message);
                            if (result.ok) router.refresh();
                          })();
                        }}
                      >
                        Accept
                      </ActionButton>
                    ) : null}
                    {canDecline ? (
                      <ConfirmActionButton
                        label="Decline"
                        confirmLabel="Confirm decline"
                        onConfirm={async () => {
                          const result = await declineCoachBookingRequest(
                            booking.id
                          );
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
                          const result = await cancelCoachBookingRequest(
                            booking.id
                          );
                          setMessage(result.message);
                          if (result.ok) router.refresh();
                          return result;
                        }}
                      />
                    ) : null}
                    {canComplete ? (
                      <ConfirmActionButton
                        label="Complete"
                        confirmLabel="Confirm complete"
                        tone="neutral"
                        onConfirm={async () => {
                          const result = await completeCoachBookingRequest(
                            booking.id
                          );
                          setMessage(result.message);
                          if (result.ok) router.refresh();
                          return result;
                        }}
                      />
                    ) : null}
                    <Link
                      href={`/coach/${booking.coach_id}`}
                      className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-semibold text-primary/70"
                    >
                      Coach
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
