"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { formatMoney } from "@/lib/coachAvailability/pricing";
import {
  addLocalDays,
  formatInTimeZone,
  hmInTimeZone,
  todayYmdInTimeZone,
  ymdInTimeZone,
  zonedLocalToUtc,
} from "@/lib/coachAvailability/timezone";

export type CalendarContext = "public" | "coach_preview" | "venue_preview";

export type CalendarSlot = {
  startsAt: string;
  endsAt: string;
  timezone: string;
  venueId?: string;
  venueName?: string;
  priceAmountMinor: number | null;
  currency: string | null;
  state?: "available" | "requested" | "confirmed" | "reserved";
  requestedCount?: number;
  href?: string;
  coachId?: string;
  coachName?: string;
  coachImageUrl?: string | null;
  coachRole?: string | null;
  relationshipId?: string;
  durationMinutes?: number;
  /** Venue management preview: public vs hidden schedule. */
  visibility?: "public" | "hidden";
};

type Props = {
  slots: CalendarSlot[];
  timezone: string;
  context: CalendarContext;
  /** Preferred multi-coach selection key: `${relationshipId ?? ""}|${startsAt}` */
  selectedKey?: string | null;
  /** @deprecated Prefer selectedKey for multi-coach calendars */
  selectedStartsAt?: string | null;
  onSelect?: (slot: CalendarSlot) => void;
  startDate?: string;
  numberOfDays?: number;
  selectable?: boolean;
  emptyMessage?: string;
};

const HOUR_PX = 56;
const MIN_SLOT_PX = 28;
const DEFAULT_EMPTY_MESSAGE = "No sessions are available this week.";

export function calendarSlotKey(slot: Pick<CalendarSlot, "relationshipId" | "startsAt">) {
  return `${slot.relationshipId ?? ""}|${slot.startsAt}`;
}

function minutesFromMidnight(iso: string, timeZone: string): number {
  const hm = hmInTimeZone(iso, timeZone);
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

function localNoon(dateYmd: string, timeZone: string) {
  return zonedLocalToUtc(dateYmd, "12:00", timeZone);
}

function formatDayHeading(dateYmd: string, timeZone: string, long = false) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: long ? "long" : "short",
    day: "numeric",
    month: long ? "long" : "short",
  }).format(localNoon(dateYmd, timeZone));
}

function slotPriceLabel(slot: CalendarSlot) {
  return formatMoney(slot.priceAmountMinor, slot.currency);
}

function slotStateLabel(slot: CalendarSlot, context: CalendarContext): string | null {
  if (context === "public") return null;
  if (slot.state === "confirmed") return "Confirmed";
  if (slot.state === "reserved") return "Reserved";
  if (slot.state === "requested") {
    if (context === "venue_preview") {
      return "Request awaiting coach response";
    }
    const n = slot.requestedCount ?? 0;
    if (n > 0) return n === 1 ? "1 request" : `${n} requests`;
    return "Request awaiting coach response";
  }
  if (context === "venue_preview" && slot.visibility === "hidden") {
    return "Hidden from public";
  }
  return null;
}

function slotAccessibleName(slot: CalendarSlot, context: CalendarContext) {
  const time = formatInTimeZone(slot.startsAt, slot.timezone, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const head = slot.coachName ? `${time} with ${slot.coachName}` : time;
  const parts = [head, slotPriceLabel(slot)];
  const state = slotStateLabel(slot, context);
  if (state) parts.push(state);
  return parts.join(", ");
}

function isInspectOnlySlot(slot: CalendarSlot) {
  return slot.state === "reserved" || slot.state === "confirmed" || slot.state === "requested";
}

function isBlockedSlot(slot: CalendarSlot, context: CalendarContext) {
  if (context === "public") return false;
  // Venue operations calendar: reserved/requested remain inspectable when selectable.
  if (context === "venue_preview") return false;
  return slot.state === "confirmed" || slot.state === "reserved";
}

function dayColumnDates(startYmd: string, numberOfDays: number) {
  return Array.from({ length: numberOfDays }, (_, i) => addLocalDays(startYmd, i));
}

function groupSlotsByStartMinute(
  daySlots: CalendarSlot[],
  timezone: string
): Array<{ startMin: number; slots: CalendarSlot[] }> {
  const groups = new Map<number, CalendarSlot[]>();
  for (const slot of daySlots) {
    const startMin = minutesFromMidnight(slot.startsAt, timezone);
    const list = groups.get(startMin) ?? [];
    list.push(slot);
    groups.set(startMin, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([startMin, slots]) => ({ startMin, slots }));
}

export default function AvailabilityCalendar({
  slots,
  timezone,
  context,
  selectedKey = null,
  selectedStartsAt = null,
  onSelect,
  startDate: startDateProp,
  numberOfDays = 7,
  selectable = context === "public",
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
}: Props) {
  const todayYmd = todayYmdInTimeZone(timezone);
  const [rangeStart, setRangeStart] = useState(
    startDateProp ?? todayYmd
  );

  const rangeEndExclusive = addLocalDays(rangeStart, numberOfDays);
  const days = useMemo(
    () => dayColumnDates(rangeStart, numberOfDays),
    [rangeStart, numberOfDays]
  );

  const visibleSlots = useMemo(
    () =>
      slots.filter((slot) => {
        const date = ymdInTimeZone(slot.startsAt, timezone);
        return date >= rangeStart && date < rangeEndExclusive;
      }),
    [slots, timezone, rangeStart, rangeEndExclusive]
  );

  const slotsByDate = useMemo(() => {
    const map = new Map<string, CalendarSlot[]>();
    for (const day of days) map.set(day, []);
    for (const slot of visibleSlots) {
      const date = ymdInTimeZone(slot.startsAt, timezone);
      const list = map.get(date);
      if (list) list.push(slot);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const byStart = a.startsAt.localeCompare(b.startsAt);
        if (byStart !== 0) return byStart;
        return (a.relationshipId ?? "").localeCompare(b.relationshipId ?? "");
      });
    }
    return map;
  }, [days, visibleSlots, timezone]);

  const { minMinutes, spanMinutes } = useMemo(() => {
    if (visibleSlots.length === 0) {
      return { minMinutes: 8 * 60, spanMinutes: 10 * 60 };
    }
    let min = Infinity;
    let max = -Infinity;
    for (const slot of visibleSlots) {
      min = Math.min(min, minutesFromMidnight(slot.startsAt, timezone));
      max = Math.max(max, minutesFromMidnight(slot.endsAt, timezone));
    }
    const minMinutes = Math.max(0, Math.floor(min / 60) * 60);
    const maxMinutes = Math.min(24 * 60, Math.ceil(max / 60) * 60);
    return {
      minMinutes,
      spanMinutes: Math.max(maxMinutes - minMinutes, 60),
    };
  }, [visibleSlots, timezone]);

  const hourLabels = useMemo(() => {
    const labels: number[] = [];
    for (let m = minMinutes; m < minMinutes + spanMinutes; m += 60) {
      labels.push(m);
    }
    return labels;
  }, [minMinutes, spanMinutes]);

  const rangeLabel = useMemo(() => {
    const endInclusive = addLocalDays(rangeStart, numberOfDays - 1);
    const startFmt = formatDayHeading(rangeStart, timezone, false);
    const endFmt = formatDayHeading(endInclusive, timezone, false);
    return `${startFmt} – ${endFmt}`;
  }, [rangeStart, numberOfDays, timezone]);

  function goPrev() {
    setRangeStart((current) => addLocalDays(current, -numberOfDays));
  }

  function goNext() {
    setRangeStart((current) => addLocalDays(current, numberOfDays));
  }

  function handleSelect(slot: CalendarSlot) {
    if (!selectable || isBlockedSlot(slot, context)) return;
    onSelect?.(slot);
  }

  function isSlotSelected(slot: CalendarSlot) {
    if (selectedKey != null) return selectedKey === calendarSlotKey(slot);
    return selectedStartsAt === slot.startsAt;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous date range"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-primary/15 bg-surface text-primary transition hover:border-primary/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <p className="min-w-[10rem] text-center text-sm font-semibold text-primary">
            {rangeLabel}
          </p>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next date range"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-primary/15 bg-surface text-primary transition hover:border-primary/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <p className="text-xs font-medium text-primary/55" aria-live="polite">
          Times in {timezone}
        </p>
      </div>

      {visibleSlots.length === 0 ? (
        <p className="rounded-2xl border border-primary/10 bg-surface/50 px-4 py-8 text-center text-sm text-primary/55">
          {emptyMessage}
        </p>
      ) : (
        <>
          {/* Mobile agenda */}
          <div className="space-y-5 md:hidden">
            {days.map((dateYmd) => {
              const daySlots = slotsByDate.get(dateYmd) ?? [];
              if (daySlots.length === 0) return null;
              const isToday = dateYmd === todayYmd;
              return (
                <section key={dateYmd} aria-labelledby={`agenda-${dateYmd}`}>
                  <h3
                    id={`agenda-${dateYmd}`}
                    className={`text-sm font-semibold ${
                      isToday ? "text-primary" : "text-primary/80"
                    }`}
                  >
                    {formatDayHeading(dateYmd, timezone, true)}
                    {isToday ? (
                      <span className="ml-2 text-xs font-medium text-primary/55">
                        Today
                      </span>
                    ) : null}
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {daySlots.map((slot) => (
                      <li key={calendarSlotKey(slot)}>
                        <AgendaSlot
                          slot={slot}
                          context={context}
                          selectable={selectable}
                          selected={isSlotSelected(slot)}
                          onSelect={handleSelect}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          {/* Desktop week grid */}
          <div className="hidden overflow-x-auto md:block">
            <div
              className="min-w-[44rem] rounded-2xl border border-primary/10 bg-white"
              style={{
                display: "grid",
                gridTemplateColumns: `3.5rem repeat(${numberOfDays}, minmax(0, 1fr))`,
              }}
            >
              <div className="border-b border-primary/10" />
              {days.map((dateYmd) => {
                const isToday = dateYmd === todayYmd;
                return (
                  <div
                    key={`head-${dateYmd}`}
                    className={`border-b border-l border-primary/10 px-2 py-2 text-center ${
                      isToday ? "bg-primary/[0.04]" : ""
                    }`}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/50">
                      {formatInTimeZone(localNoon(dateYmd, timezone), timezone, {
                        weekday: "short",
                      })}
                    </p>
                    <p
                      className={`mt-0.5 text-sm font-bold ${
                        isToday
                          ? "inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-accent"
                          : "text-primary"
                      }`}
                    >
                      {formatInTimeZone(localNoon(dateYmd, timezone), timezone, {
                        day: "numeric",
                      })}
                    </p>
                    {isToday ? (
                      <span className="sr-only">Today</span>
                    ) : null}
                  </div>
                );
              })}

              <div className="relative" style={{ height: (spanMinutes / 60) * HOUR_PX }}>
                {hourLabels.map((mins) => (
                  <div
                    key={mins}
                    className="absolute right-1 -translate-y-1/2 text-[10px] font-medium text-primary/40"
                    style={{ top: ((mins - minMinutes) / 60) * HOUR_PX }}
                  >
                    {`${String(Math.floor(mins / 60)).padStart(2, "0")}:00`}
                  </div>
                ))}
              </div>

              {days.map((dateYmd) => {
                const daySlots = slotsByDate.get(dateYmd) ?? [];
                const isToday = dateYmd === todayYmd;
                const startGroups = groupSlotsByStartMinute(daySlots, timezone);
                return (
                  <div
                    key={`col-${dateYmd}`}
                    className={`relative border-l border-primary/10 ${
                      isToday ? "bg-primary/[0.03]" : "bg-surface/20"
                    }`}
                    style={{ height: (spanMinutes / 60) * HOUR_PX }}
                  >
                    {hourLabels.map((mins) => (
                      <div
                        key={mins}
                        className="pointer-events-none absolute inset-x-0 border-t border-primary/5"
                        style={{ top: ((mins - minMinutes) / 60) * HOUR_PX }}
                      />
                    ))}
                    {startGroups.map(({ startMin, slots: groupSlots }) => {
                      const maxEndMin = Math.max(
                        ...groupSlots.map((slot) =>
                          minutesFromMidnight(slot.endsAt, timezone)
                        )
                      );
                      const top = ((startMin - minMinutes) / 60) * HOUR_PX;
                      const height = Math.max(
                        ((maxEndMin - startMin) / 60) * HOUR_PX,
                        MIN_SLOT_PX * groupSlots.length
                      );
                      return (
                        <div
                          key={`group-${startMin}`}
                          className="absolute inset-x-1 z-10 flex flex-col gap-0.5"
                          style={{ top, height }}
                        >
                          {groupSlots.map((slot) => (
                            <div
                              key={calendarSlotKey(slot)}
                              className="min-h-0 flex-1"
                            >
                              <GridSlot
                                slot={slot}
                                context={context}
                                selectable={selectable}
                                selected={isSlotSelected(slot)}
                                onSelect={handleSelect}
                              />
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AgendaSlot({
  slot,
  context,
  selectable,
  selected,
  onSelect,
}: {
  slot: CalendarSlot;
  context: CalendarContext;
  selectable: boolean;
  selected: boolean;
  onSelect: (slot: CalendarSlot) => void;
}) {
  const blocked = isBlockedSlot(slot, context);
  const timeLabel = formatInTimeZone(slot.startsAt, slot.timezone, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const price = slotPriceLabel(slot);
  const stateLabel = slotStateLabel(slot, context);
  const name = slotAccessibleName(slot, context);
  const showRequestLink =
    context === "coach_preview" &&
    slot.state === "requested" &&
    Boolean(slot.href);

  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-semibold">{timeLabel}</span>
        {slot.coachName ? (
          <span className="max-w-[10rem] truncate text-xs font-medium opacity-80">
            {slot.coachName}
          </span>
        ) : null}
        <span className="text-xs font-medium opacity-70">{price}</span>
      </span>
      {stateLabel ? (
        <span className="inline-flex items-center gap-1 text-xs font-semibold">
          {blocked ? <Lock className="h-3 w-3" aria-hidden /> : null}
          {stateLabel}
        </span>
      ) : null}
    </>
  );

  const baseClass =
    "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

  if (showRequestLink && slot.href) {
    return (
      <Link
        href={slot.href}
        aria-label={`${name}. Review requests`}
        className={`${baseClass} border-amber-200 bg-amber-50 text-amber-950 hover:border-amber-300`}
      >
        {body}
      </Link>
    );
  }

  if (selectable && !blocked) {
    const inspect = isInspectOnlySlot(slot);
    return (
      <button
        type="button"
        onClick={() => onSelect(slot)}
        aria-pressed={selected}
        aria-label={name}
        className={`${baseClass} ${
          selected
            ? "border-primary bg-primary text-accent"
            : inspect
              ? "border-primary/10 bg-surface/70 text-primary/80 hover:border-primary/25"
              : "border-primary/15 bg-surface text-primary hover:border-primary/30"
        }`}
      >
        {body}
      </button>
    );
  }

  return (
    <div
      aria-label={name}
      className={`${baseClass} ${
        blocked
          ? "border-primary/10 bg-surface/70 text-primary/55"
          : "border-primary/10 bg-surface/50 text-primary"
      }`}
    >
      {body}
    </div>
  );
}

function GridSlot({
  slot,
  context,
  selectable,
  selected,
  onSelect,
}: {
  slot: CalendarSlot;
  context: CalendarContext;
  selectable: boolean;
  selected: boolean;
  onSelect: (slot: CalendarSlot) => void;
}) {
  const blocked = isBlockedSlot(slot, context);
  const timeLabel = formatInTimeZone(slot.startsAt, slot.timezone, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const price = slotPriceLabel(slot);
  const stateLabel = slotStateLabel(slot, context);
  const name = slotAccessibleName(slot, context);
  const showRequestLink =
    context === "coach_preview" &&
    slot.state === "requested" &&
    Boolean(slot.href);

  const inner = (
    <>
      <span className="block truncate text-[11px] font-bold leading-tight">
        {timeLabel}
      </span>
      {slot.coachName ? (
        <span className="mt-0.5 block truncate text-[10px] font-medium leading-tight opacity-80">
          {slot.coachName}
        </span>
      ) : null}
      <span className="mt-0.5 block truncate text-[10px] font-medium leading-tight opacity-80">
        {price}
      </span>
      {stateLabel ? (
        <span className="mt-0.5 flex items-center gap-0.5 truncate text-[10px] font-semibold leading-tight">
          {blocked ? <Lock className="h-2.5 w-2.5 shrink-0" aria-hidden /> : null}
          <span className="truncate">{stateLabel}</span>
        </span>
      ) : null}
    </>
  );

  const baseClass =
    "block h-full w-full overflow-hidden rounded-lg border px-1.5 py-1 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary";

  if (showRequestLink && slot.href) {
    return (
      <Link
        href={slot.href}
        aria-label={`${name}. Review requests`}
        className={`${baseClass} border-amber-200 bg-amber-50 text-amber-950 hover:border-amber-300`}
      >
        {inner}
      </Link>
    );
  }

  if (selectable && !blocked) {
    const inspect = isInspectOnlySlot(slot);
    return (
      <button
        type="button"
        onClick={() => onSelect(slot)}
        aria-pressed={selected}
        aria-label={name}
        className={`${baseClass} ${
          selected
            ? "border-primary bg-primary text-accent"
            : inspect
              ? "border-primary/10 bg-primary/5 text-primary/80 hover:border-primary/25"
              : "border-primary/20 bg-white text-primary hover:border-primary/40 hover:bg-surface"
        }`}
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      aria-label={name}
      className={`${baseClass} ${
        blocked
          ? "border-primary/10 bg-primary/5 text-primary/55"
          : "border-primary/10 bg-white text-primary"
      }`}
    >
      {inner}
    </div>
  );
}
