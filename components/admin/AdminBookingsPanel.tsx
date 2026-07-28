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
  adminBookingPageSize,
  buildAdminBookingQueryString,
  formatAdminBookingPrice,
  type AdminBookingQuickView,
  type AdminBookingSortKey,
  type ParsedAdminBookingParams,
} from "@/lib/admin/bookingTable";
import {
  BOOKING_STATUS_LABELS,
  BOOKING_STATUSES,
} from "@/lib/coachBookings/constants";
import {
  formatBookingWhen,
  statusTone,
} from "@/lib/coachBookings/display";
import type { CoachBookingRequest } from "@/lib/coachBookings/types";

const QUICK_VIEWS: { value: AdminBookingQuickView; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "awaiting", label: "Awaiting response" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All" },
];

const SORT_COLUMNS: { key: AdminBookingSortKey; label: string }[] = [
  { key: "starts_at", label: "Session" },
  { key: "created_at", label: "Created" },
  { key: "status", label: "Status" },
  { key: "coach", label: "Coach" },
  { key: "venue", label: "Venue" },
  { key: "price", label: "Price" },
];

type Props = {
  rows: CoachBookingRequest[];
  params: ParsedAdminBookingParams;
  total: number;
  pageCount: number;
  canManage: boolean;
  nowMs: number;
};

export default function AdminBookingsPanel({
  rows,
  params,
  total,
  pageCount,
  canManage,
  nowMs,
}: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  function sortHref(key: AdminBookingSortKey) {
    const nextDir =
      params.sort === key && params.dir === "asc" ? "desc" : "asc";
    return `/admin/bookings${buildAdminBookingQueryString({
      ...params,
      sort: key,
      dir: nextDir,
      page: 1,
    })}`;
  }

  function viewHref(view: AdminBookingQuickView) {
    return `/admin/bookings${buildAdminBookingQueryString({
      ...params,
      view,
      page: 1,
    })}`;
  }

  function pageHref(page: number) {
    return `/admin/bookings${buildAdminBookingQueryString({
      ...params,
      page,
    })}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {QUICK_VIEWS.map((view) => {
          const active = params.view === view.value;
          return (
            <Link
              key={view.value}
              href={viewHref(view.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "bg-primary text-accent"
                  : "border border-primary/15 bg-white text-primary/70 hover:bg-surface"
              }`}
            >
              {view.label}
            </Link>
          );
        })}
      </div>

      <form
        className="grid gap-3 rounded-2xl border border-primary/10 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6"
        method="get"
      >
        <input type="hidden" name="view" value={params.view} />
        <label className="text-xs font-semibold text-primary/60 lg:col-span-2">
          Search
          <input
            name="q"
            defaultValue={params.q}
            placeholder="Requester, coach, venue, email…"
            className="mt-1 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-semibold text-primary/60">
          Status
          <select
            name="status"
            defaultValue={params.status ?? ""}
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
            defaultValue={params.coach}
            placeholder="Name contains…"
            className="mt-1 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-semibold text-primary/60">
          Venue
          <input
            name="venue"
            defaultValue={params.venue}
            placeholder="Name contains…"
            className="mt-1 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-semibold text-primary/60">
          From
          <input
            type="date"
            name="from"
            defaultValue={params.from ?? ""}
            className="mt-1 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-semibold text-primary/60">
          To
          <input
            type="date"
            name="to"
            defaultValue={params.to ?? ""}
            className="mt-1 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2 text-sm"
          />
        </label>
        <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-6">
          <button
            type="submit"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent"
          >
            Apply filters
          </button>
          <Link
            href="/admin/bookings"
            className="rounded-xl border border-primary/15 px-4 py-2 text-sm font-semibold text-primary/70"
          >
            Reset
          </Link>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-primary/60">
        <p>
          {total} booking{total === 1 ? "" : "s"}
          {total > adminBookingPageSize()
            ? ` · page ${params.page} of ${pageCount}`
            : ""}
        </p>
        {!canManage ? (
          <p className="rounded-lg border border-primary/10 bg-surface px-3 py-1.5 text-xs font-semibold text-primary/55">
            Read-only — you can review bookings but not change their status.
          </p>
        ) : null}
      </div>

      {message ? (
        <p className="text-sm text-primary/65" role="status">
          {message}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-primary/20 bg-white p-8 text-center text-sm text-primary/55">
          No bookings match these filters.
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border border-primary/10 bg-white md:block">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-primary/10 bg-surface text-xs uppercase tracking-wide text-primary/60">
                  {SORT_COLUMNS.map((column) => (
                    <th key={column.key} className="px-4 py-3 font-semibold">
                      <Link
                        href={sortHref(column.key)}
                        className="inline-flex items-center gap-1 hover:text-primary"
                      >
                        {column.label}
                        {params.sort === column.key ? (
                          <span aria-hidden>{params.dir === "asc" ? "↑" : "↓"}</span>
                        ) : null}
                      </Link>
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold">Requester</th>
                  <th className="px-4 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {rows.map((booking) => (
                  <BookingTableRow
                    key={booking.id}
                    booking={booking}
                    canManage={canManage}
                    nowMs={nowMs}
                    onMessage={setMessage}
                    onRefresh={() => router.refresh()}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-4 md:hidden">
            {rows.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                canManage={canManage}
                nowMs={nowMs}
                onMessage={setMessage}
                onRefresh={() => router.refresh()}
              />
            ))}
          </ul>
        </>
      )}

      {pageCount > 1 ? (
        <nav
          className="flex flex-wrap items-center justify-center gap-2"
          aria-label="Bookings pagination"
        >
          {params.page > 1 ? (
            <Link
              href={pageHref(params.page - 1)}
              className="rounded-xl border border-primary/15 px-3 py-2 text-sm font-semibold"
            >
              Previous
            </Link>
          ) : null}
          <span className="px-2 text-sm text-primary/60">
            Page {params.page} of {pageCount}
          </span>
          {params.page < pageCount ? (
            <Link
              href={pageHref(params.page + 1)}
              className="rounded-xl border border-primary/15 px-3 py-2 text-sm font-semibold"
            >
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}

function BookingTableRow({
  booking,
  canManage,
  nowMs,
  onMessage,
  onRefresh,
}: {
  booking: CoachBookingRequest;
  canManage: boolean;
  nowMs: number;
  onMessage: (message: string) => void;
  onRefresh: () => void;
}) {
  const actions = bookingActions(booking, nowMs);

  return (
    <tr className="border-b border-primary/5 last:border-0">
      <td className="px-4 py-3 text-primary/80">
        <p>{formatBookingWhen(booking)}</p>
        <p className="text-xs text-primary/45">{booking.timezone}</p>
      </td>
      <td className="px-4 py-3 text-primary/70">
        {new Date(booking.created_at).toLocaleString()}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold ${statusTone(
            booking.status
          )}`}
        >
          {BOOKING_STATUS_LABELS[booking.status]}
        </span>
      </td>
      <td className="px-4 py-3 font-medium text-primary">
        {booking.coach?.name ?? "—"}
      </td>
      <td className="px-4 py-3 text-primary/80">
        {booking.venue?.name ?? "—"}
      </td>
      <td className="px-4 py-3 text-primary/80">
        {formatAdminBookingPrice(
          booking.price_amount_minor,
          booking.currency
        )}
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-primary">{booking.requester_name}</p>
        <p className="text-xs text-primary/55">{booking.requester_email}</p>
      </td>
      <td className="px-4 py-3 text-right">
        <BookingActions
          booking={booking}
          canManage={canManage}
          actions={actions}
          onMessage={onMessage}
          onRefresh={onRefresh}
        />
      </td>
    </tr>
  );
}

function BookingCard({
  booking,
  canManage,
  nowMs,
  onMessage,
  onRefresh,
}: {
  booking: CoachBookingRequest;
  canManage: boolean;
  nowMs: number;
  onMessage: (message: string) => void;
  onRefresh: () => void;
}) {
  const actions = bookingActions(booking, nowMs);

  return (
    <li className="rounded-2xl border border-primary/10 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-primary">
            {booking.coach?.name ?? "Coach"} · {booking.venue?.name ?? "Venue"}
          </p>
          <p className="mt-1 text-sm text-primary/65">
            {booking.requester_name} · {booking.requester_email}
          </p>
          <p className="mt-1 text-sm text-primary/70">
            {formatBookingWhen(booking)} · {booking.timezone}
          </p>
          <p className="mt-1 text-sm text-primary/55">
            {formatAdminBookingPrice(
              booking.price_amount_minor,
              booking.currency
            )}
          </p>
          <p
            className={`mt-3 inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold ${statusTone(
              booking.status
            )}`}
          >
            {BOOKING_STATUS_LABELS[booking.status]}
          </p>
        </div>
        <BookingActions
          booking={booking}
          canManage={canManage}
          actions={actions}
          onMessage={onMessage}
          onRefresh={onRefresh}
        />
      </div>
    </li>
  );
}

function bookingActions(booking: CoachBookingRequest, nowMs: number) {
  const ended = new Date(booking.ends_at).getTime() <= nowMs;
  return {
    canAccept: booking.status === "requested",
    canDecline: booking.status === "requested",
    canCancel:
      booking.status === "requested" || booking.status === "accepted",
    canComplete: booking.status === "accepted" && ended,
  };
}

function BookingActions({
  booking,
  canManage,
  actions,
  onMessage,
  onRefresh,
}: {
  booking: CoachBookingRequest;
  canManage: boolean;
  actions: ReturnType<typeof bookingActions>;
  onMessage: (message: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {canManage && actions.canAccept ? (
        <ActionButton
          onClick={() => {
            void (async () => {
              const result = await acceptCoachBookingRequest(booking.id);
              onMessage(result.message);
              if (result.ok) onRefresh();
            })();
          }}
        >
          Accept
        </ActionButton>
      ) : null}
      {canManage && actions.canDecline ? (
        <ConfirmActionButton
          label="Decline"
          confirmLabel="Confirm decline"
          onConfirm={async () => {
            const result = await declineCoachBookingRequest(booking.id);
            onMessage(result.message);
            if (result.ok) onRefresh();
            return result;
          }}
        />
      ) : null}
      {canManage && actions.canCancel ? (
        <ConfirmActionButton
          label="Cancel"
          confirmLabel="Confirm cancel"
          onConfirm={async () => {
            const result = await cancelCoachBookingRequest(booking.id);
            onMessage(result.message);
            if (result.ok) onRefresh();
            return result;
          }}
        />
      ) : null}
      {canManage && actions.canComplete ? (
        <ConfirmActionButton
          label="Complete"
          confirmLabel="Confirm complete"
          tone="neutral"
          onConfirm={async () => {
            const result = await completeCoachBookingRequest(booking.id);
            onMessage(result.message);
            if (result.ok) onRefresh();
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
  );
}
