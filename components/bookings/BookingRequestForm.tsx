"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCoachBookingRequest } from "@/app/account/bookings/actions";
import {
  PAYMENT_COPY,
  PLAYER_LEVEL_LABELS,
  PLAYER_LEVELS,
} from "@/lib/coachBookings/constants";
import { formatBookingSessionPrice } from "@/lib/coachBookings/display";
import type { BookingSlotContext } from "@/lib/coachBookings/types";
import { formatInTimeZone } from "@/lib/coachAvailability/timezone";

export default function BookingRequestForm({
  slot,
  defaultName,
  accountEmail,
}: {
  slot: BookingSlotContext;
  defaultName: string;
  accountEmail: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState("");
  const [playerLevel, setPlayerLevel] = useState("");
  const [message, setMessage] = useState("");
  const [paymentAcknowledged, setPaymentAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const when = formatInTimeZone(slot.startsAt, slot.timezone, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await createCoachBookingRequest({
            coachId: slot.coachId,
            relationshipId: slot.relationshipId,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            requesterName: name,
            requesterPhone: phone,
            playerLevel,
            message,
            paymentAcknowledged,
          });
          if (!result.ok || !result.bookingId) {
            setError(result.message);
            return;
          }
          router.push(`/account/bookings/${result.bookingId}`);
          router.refresh();
        });
      }}
    >
      <section className="rounded-[24px] border border-primary/10 bg-white p-5 sm:p-6">
        <h1 className="text-2xl font-bold text-primary">Request a session</h1>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-primary/45">Coach</dt>
            <dd className="font-semibold text-primary">{slot.coachName}</dd>
          </div>
          <div>
            <dt className="text-primary/45">Venue</dt>
            <dd className="font-semibold text-primary">{slot.venueName}</dd>
          </div>
          <div>
            <dt className="text-primary/45">When</dt>
            <dd className="font-semibold text-primary">
              {when} · {slot.timezone}
            </dd>
          </div>
          <div>
            <dt className="text-primary/45">Duration</dt>
            <dd className="font-semibold text-primary">
              {slot.durationMinutes} minutes
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-primary/45">Price</dt>
            <dd className="font-semibold text-primary">
              {formatBookingSessionPrice(slot.priceAmountMinor, slot.currency)}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-primary/60">{PAYMENT_COPY}</p>
      </section>

      <section className="space-y-4 rounded-[24px] border border-primary/10 bg-white p-5 sm:p-6">
        <label className="block text-sm font-semibold text-primary">
          Name
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2.5 text-sm font-normal"
          />
        </label>
        <label className="block text-sm font-semibold text-primary">
          Email
          <input
            value={accountEmail}
            readOnly
            className="mt-2 w-full rounded-xl border border-primary/10 bg-surface/70 px-3 py-2.5 text-sm font-normal text-primary/70"
          />
          <span className="mt-1 block text-xs font-normal text-primary/50">
            Sent from your account email.
          </span>
        </label>
        <label className="block text-sm font-semibold text-primary">
          Phone <span className="font-normal text-primary/45">(optional)</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-2 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2.5 text-sm font-normal"
          />
        </label>
        <label className="block text-sm font-semibold text-primary">
          Player level{" "}
          <span className="font-normal text-primary/45">(optional)</span>
          <select
            value={playerLevel}
            onChange={(e) => setPlayerLevel(e.target.value)}
            className="mt-2 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2.5 text-sm font-normal"
          >
            <option value="">Not specified</option>
            {PLAYER_LEVELS.map((level) => (
              <option key={level} value={level}>
                {PLAYER_LEVEL_LABELS[level]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-primary">
          Anything the coach should know?
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
            rows={4}
            className="mt-2 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2.5 text-sm font-normal"
          />
          <span className="mt-1 block text-xs font-normal text-primary/50">
            Share your goals, experience or any useful details. {message.length}
            /1000
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm text-primary/80">
          <input
            type="checkbox"
            checked={paymentAcknowledged}
            onChange={(e) => setPaymentAcknowledged(e.target.checked)}
            className="mt-1"
            required
          />
          <span>
            I understand that payment and final arrangements are handled
            directly with the coach.
          </span>
        </label>
      </section>

      {error ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending || !paymentAcknowledged}
          aria-disabled={pending || !paymentAcknowledged}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent transition disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send booking request"}
        </button>
        <Link
          href={`/coach/${slot.coachId}`}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/15 px-5 py-2.5 text-sm font-semibold text-primary/70"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
