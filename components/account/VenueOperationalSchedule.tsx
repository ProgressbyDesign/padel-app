"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import AvailabilityCalendar, {
  type CalendarSlot,
} from "@/components/availability/AvailabilityCalendar";
import { formatInTimeZone } from "@/lib/coachAvailability/timezone";
import {
  bookedSessionPriceCaption,
  currentSessionPriceLine,
} from "@/lib/venueOperations/pricingDisplay";
import {
  filterOperationalSlots,
  operationalSlotIdentity,
  parseScheduleSearchParams,
  type VenueScheduleFilterState,
} from "@/lib/venueOperations/scheduleFilters";
import type {
  VenueOperationalCalendarSlot,
  VenueScheduleStateFilter,
} from "@/lib/venueOperations/types";

type Props = {
  venueId: string;
  venueName: string;
  slots: VenueOperationalCalendarSlot[];
  hasActiveCoaches: boolean;
  primaryTimezone: string;
  timezoneInconsistency: boolean;
  coaches: Array<{ id: string; name: string }>;
};

function toCalendarSlot(slot: VenueOperationalCalendarSlot): CalendarSlot {
  const useBooked =
    slot.state === "reserved" || slot.state === "requested";
  return {
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    timezone: slot.timezone,
    venueId: slot.venueId,
    venueName: slot.venueName,
    priceAmountMinor: useBooked
      ? (slot.bookedPriceAmountMinor ?? slot.priceAmountMinor)
      : slot.priceAmountMinor,
    currency: useBooked
      ? (slot.bookedCurrency ?? slot.currency)
      : slot.currency,
    state: slot.state,
    visibility: slot.visibility,
    coachId: slot.coachId,
    coachName: slot.coachName,
    coachImageUrl: slot.coachImageUrl,
    coachRole: slot.coachRole,
    relationshipId: slot.relationshipId,
    durationMinutes: slot.durationMinutes,
    requestedCount: slot.requestedCount,
  };
}

function buildFilterQuery(filter: VenueScheduleFilterState): string {
  const params = new URLSearchParams();
  if (filter.coachId !== "all") params.set("coach", filter.coachId);
  if (filter.visibility !== "all") params.set("visibility", filter.visibility);
  const defaultStates = ["available", "reserved"];
  const isDefaultStates =
    filter.states.length === defaultStates.length &&
    defaultStates.every((s) => filter.states.includes(s as VenueScheduleStateFilter));
  if (!isDefaultStates) {
    params.set("states", filter.states.join(","));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function slotStatusCopy(slot: VenueOperationalCalendarSlot): string {
  if (slot.state === "reserved") return "Reserved";
  if (slot.state === "requested") return "Request awaiting coach response";
  if (slot.visibility === "hidden") return "Hidden from public";
  return "Available";
}

export default function VenueOperationalSchedule({
  venueId,
  venueName,
  slots,
  hasActiveCoaches,
  primaryTimezone,
  timezoneInconsistency,
  coaches,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filter = useMemo(
    () =>
      parseScheduleSearchParams({
        coach: searchParams.get("coach"),
        visibility: searchParams.get("visibility"),
        states: searchParams.get("states"),
      }),
    [searchParams]
  );

  const [selected, setSelected] = useState<VenueOperationalCalendarSlot | null>(
    null
  );

  const filtered = useMemo(
    () => filterOperationalSlots(slots, filter),
    [slots, filter]
  );

  const slotByIdentity = useMemo(() => {
    const map = new Map<string, VenueOperationalCalendarSlot>();
    for (const slot of slots) {
      map.set(operationalSlotIdentity(slot), slot);
    }
    return map;
  }, [slots]);

  const calendarSlots = useMemo(
    () => filtered.map(toCalendarSlot),
    [filtered]
  );

  function updateFilter(next: VenueScheduleFilterState) {
    router.replace(`${pathname}${buildFilterQuery(next)}`, { scroll: false });
  }

  function toggleState(state: VenueScheduleStateFilter) {
    const has = filter.states.includes(state);
    const states = has
      ? filter.states.filter((s) => s !== state)
      : [...filter.states, state];
    if (states.length === 0) return;
    updateFilter({ ...filter, states });
  }

  function handleSelect(calendarSlot: CalendarSlot) {
    const identity = operationalSlotIdentity({
      relationshipId: calendarSlot.relationshipId ?? "",
      startsAt: calendarSlot.startsAt,
      endsAt: calendarSlot.endsAt,
      coachId: calendarSlot.coachId ?? "",
    });
    const op = slotByIdentity.get(identity) ?? null;
    setSelected(op);
  }

  const emptyMessage = !hasActiveCoaches
    ? "No coaches are currently linked to this venue."
    : slots.length === 0
      ? "No sessions are available in the next two weeks."
      : "No sessions match the current filters.";

  return (
    <div className="space-y-5">
      {timezoneInconsistency ? (
        <div
          role="status"
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          Coaches at this venue use different timezones. Times below use{" "}
          <span className="font-semibold">{primaryTimezone}</span> as the primary
          display timezone; individual slots keep their own timezone labels.
        </div>
      ) : null}

      <div className="rounded-[24px] border border-primary/10 bg-white p-4 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Coach
              <select
                value={filter.coachId}
                onChange={(e) =>
                  updateFilter({
                    ...filter,
                    coachId: e.target.value === "all" ? "all" : e.target.value,
                  })
                }
                className="mt-1.5 block min-h-10 w-full rounded-xl border border-primary/15 bg-surface px-3 text-sm font-semibold text-primary sm:w-56"
              >
                <option value="all">All coaches</option>
                {coaches.map((coach) => (
                  <option key={coach.id} value={coach.id}>
                    {coach.name}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="sm:ml-2">
              <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
                Visibility
              </legend>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {(
                  [
                    ["all", "All"],
                    ["public", "Public"],
                    ["hidden", "Hidden"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      updateFilter({ ...filter, visibility: value })
                    }
                    className={`min-h-10 rounded-xl px-3 text-sm font-semibold transition ${
                      filter.visibility === value
                        ? "bg-primary text-accent"
                        : "border border-primary/15 bg-surface text-primary/75 hover:text-primary"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Status
            </legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {(
                [
                  ["available", "Available"],
                  ["reserved", "Reserved"],
                  ["requested", "Requested"],
                ] as const
              ).map(([value, label]) => {
                const on = filter.states.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleState(value)}
                    className={`min-h-10 rounded-xl px-3 text-sm font-semibold transition ${
                      on
                        ? "bg-primary text-accent"
                        : "border border-primary/15 bg-surface text-primary/75 hover:text-primary"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
      </div>

      {!hasActiveCoaches ? (
        <p className="rounded-[24px] border border-primary/10 bg-white px-4 py-10 text-center text-sm text-primary/55">
          No coaches are currently linked to this venue.{" "}
          <Link
            href={`/account/venues/${encodeURIComponent(venueId)}/coaches`}
            className="font-semibold text-primary underline"
          >
            Manage coaches
          </Link>
        </p>
      ) : (
        <section className="rounded-[24px] border border-primary/10 bg-white p-4 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-5">
          <AvailabilityCalendar
            slots={calendarSlots}
            timezone={primaryTimezone}
            context="venue_preview"
            selectable
            onSelect={handleSelect}
            emptyMessage={emptyMessage}
            numberOfDays={7}
          />
        </section>
      )}

      <SlotDetailDialog
        open={Boolean(selected)}
        slot={selected}
        venueId={venueId}
        venueName={venueName}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function SlotDetailDialog({
  open,
  slot,
  venueId,
  venueName,
  onClose,
}: {
  open: boolean;
  slot: VenueOperationalCalendarSlot | null;
  venueId: string;
  venueName: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !slot) return null;

  const dateLabel = formatInTimeZone(slot.startsAt, slot.timezone, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeLabel = `${formatInTimeZone(slot.startsAt, slot.timezone, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })}–${formatInTimeZone(slot.endsAt, slot.timezone, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })}`;

  const coachScheduleHref = `/account/venues/${encodeURIComponent(venueId)}/coaches/${encodeURIComponent(slot.coachId)}/availability`;
  const publicBookingHref = (() => {
    const params = new URLSearchParams({
      relationship: slot.relationshipId,
      start: slot.startsAt,
    });
    return `/book/coach/${encodeURIComponent(slot.coachId)}?${params.toString()}`;
  })();

  const isAvailable = slot.state === "available";
  const isReservedOrRequested =
    slot.state === "reserved" || slot.state === "requested";

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-dark/45"
        aria-label="Close session details"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-primary">
              {slot.coachName}
            </h2>
            <p className="mt-1 text-sm text-primary/60">
              {dateLabel} · {timeLabel}
            </p>
            <p className="mt-2 text-xs font-semibold text-primary/70">
              {slotStatusCopy(slot)}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-primary/15 text-primary hover:bg-surface"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-primary/55">Venue</dt>
            <dd className="font-semibold text-primary">{venueName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-primary/55">Visibility</dt>
            <dd className="font-semibold text-primary">
              {slot.visibility === "public" ? "Public" : "Hidden from public"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-primary/55">Duration</dt>
            <dd className="font-semibold text-primary">
              {slot.durationMinutes > 0
                ? `${slot.durationMinutes} minutes`
                : "—"}
            </dd>
          </div>
          {isAvailable ? (
            <div className="flex justify-between gap-4">
              <dt className="text-primary/55">Price</dt>
              <dd className="text-right font-semibold text-primary">
                {currentSessionPriceLine(
                  slot.priceAmountMinor,
                  slot.currency
                )}
              </dd>
            </div>
          ) : null}
          {isReservedOrRequested ? (
            <>
              <div className="flex justify-between gap-4">
                <dt className="text-primary/55">Price</dt>
                <dd className="text-right font-semibold text-primary">
                  {bookedSessionPriceCaption(
                    slot.bookedPriceAmountMinor ?? slot.priceAmountMinor,
                    slot.bookedCurrency ?? slot.currency
                  )}
                </dd>
              </div>
              {slot.requestedAt ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-primary/55">Requested</dt>
                  <dd className="text-right font-semibold text-primary">
                    {formatInTimeZone(slot.requestedAt, slot.timezone, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      hourCycle: "h23",
                    })}
                  </dd>
                </div>
              ) : null}
              {slot.respondedAt ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-primary/55">Responded</dt>
                  <dd className="text-right font-semibold text-primary">
                    {formatInTimeZone(slot.respondedAt, slot.timezone, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      hourCycle: "h23",
                    })}
                  </dd>
                </div>
              ) : null}
            </>
          ) : null}
        </dl>

        {isReservedOrRequested ? (
          <p className="mt-4 rounded-xl border border-primary/10 bg-surface/70 px-3 py-2.5 text-xs leading-5 text-primary/65">
            Player contact details are shared only with the coach managing the
            booking.
          </p>
        ) : null}

        {isAvailable ? (
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link
              href={coachScheduleHref}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-primary/15 px-4 text-sm font-semibold text-primary hover:bg-surface"
            >
              View coach schedule
            </Link>
            <Link
              href={publicBookingHref}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-primary/15 px-4 text-sm font-semibold text-primary hover:bg-surface"
            >
              Public booking page
            </Link>
          </div>
        ) : slot.bookingRequestId ? (
          <div className="mt-5">
            <Link
              href={`/account/venues/${encodeURIComponent(venueId)}/sessions/${encodeURIComponent(slot.bookingRequestId)}`}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-primary/15 px-4 text-sm font-semibold text-primary hover:bg-surface"
            >
              View session details
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
