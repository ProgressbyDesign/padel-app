"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type {
  CalendarContext,
  CalendarSlot,
} from "@/components/availability/AvailabilityCalendar";
import VenueCoachSelectionDialog from "@/components/availability/VenueCoachSelectionDialog";
import {
  coachesInOptions,
  durationMinutesFromRange,
  formatSessionOptionPrice,
  groupVenueSessionsByStart,
  summarizeVenueTimeGroup,
  type VenueSessionOption,
  type VenueTimeGroup,
} from "@/lib/coachAvailability/venueTimeGroups";
import {
  addLocalDays,
  formatInTimeZone,
  hmInTimeZone,
  todayYmdInTimeZone,
  ymdInTimeZone,
  zonedLocalToUtc,
} from "@/lib/coachAvailability/timezone";

type Props = {
  slots: CalendarSlot[];
  timezone?: string;
  context: Extract<CalendarContext, "public" | "venue_preview">;
  emptyMessage?: string;
  numberOfDays?: number;
};

const HOUR_PX = 56;
const MIN_BLOCK_PX = 44;

function dominantTimezone(slots: CalendarSlot[], fallback?: string): string {
  if (fallback) return fallback;
  if (slots.length === 0) return "UTC";
  const counts = new Map<string, number>();
  for (const slot of slots) {
    counts.set(slot.timezone, (counts.get(slot.timezone) ?? 0) + 1);
  }
  let best = slots[0]!.timezone;
  let bestCount = 0;
  for (const [tz, count] of counts) {
    if (count > bestCount) {
      best = tz;
      bestCount = count;
    }
  }
  return best;
}

function slotToOption(slot: CalendarSlot): VenueSessionOption | null {
  if (!slot.coachId || !slot.relationshipId) return null;
  let visibility: VenueSessionOption["visibility"];
  if (slot.state === "reserved") {
    visibility = "reserved";
  } else if (slot.visibility === "hidden") {
    visibility = "hidden";
  } else if (slot.visibility === "public") {
    visibility = "public";
  }
  return {
    coachId: slot.coachId,
    coachName: slot.coachName ?? "Coach",
    coachImageUrl: slot.coachImageUrl ?? null,
    coachRole: slot.coachRole ?? null,
    relationshipId: slot.relationshipId,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    timezone: slot.timezone,
    durationMinutes:
      slot.durationMinutes ??
      durationMinutesFromRange(slot.startsAt, slot.endsAt),
    priceAmountMinor: slot.priceAmountMinor,
    currency: slot.currency,
    visibility,
  };
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

function tooltipPrice(option: VenueSessionOption): string | null {
  const label = formatSessionOptionPrice(option);
  if (label === "Price to be agreed with coach") return null;
  return label;
}

export default function VenueAvailabilityCalendar({
  slots,
  timezone: timezoneProp,
  context,
  emptyMessage = "No sessions are available this week.",
  numberOfDays = 7,
}: Props) {
  const timezone = useMemo(
    () => dominantTimezone(slots, timezoneProp),
    [slots, timezoneProp]
  );
  const todayYmd = todayYmdInTimeZone(timezone);
  const [rangeStart, setRangeStart] = useState(todayYmd);
  const [coachFilter, setCoachFilter] = useState("all");
  const [dialogGroup, setDialogGroup] = useState<VenueTimeGroup | null>(null);

  const allOptions = useMemo(() => {
    const options: VenueSessionOption[] = [];
    for (const slot of slots) {
      const option = slotToOption(slot);
      if (option) options.push(option);
    }
    return options;
  }, [slots]);

  const rangeEndExclusive = addLocalDays(rangeStart, numberOfDays);
  const days = useMemo(
    () =>
      Array.from({ length: numberOfDays }, (_, i) =>
        addLocalDays(rangeStart, i)
      ),
    [rangeStart, numberOfDays]
  );

  const optionsInRange = useMemo(
    () =>
      allOptions.filter((option) => {
        const date = ymdInTimeZone(option.startsAt, timezone);
        return date >= rangeStart && date < rangeEndExclusive;
      }),
    [allOptions, timezone, rangeStart, rangeEndExclusive]
  );

  const coaches = useMemo(
    () => coachesInOptions(optionsInRange),
    [optionsInRange]
  );

  const effectiveCoachFilter =
    coachFilter === "all" ||
    coaches.some((coach) => coach.coachId === coachFilter)
      ? coachFilter
      : "all";

  const filteredOptions = useMemo(() => {
    if (effectiveCoachFilter === "all") return optionsInRange;
    return optionsInRange.filter(
      (option) => option.coachId === effectiveCoachFilter
    );
  }, [optionsInRange, effectiveCoachFilter]);

  const timeGroups = useMemo(
    () => groupVenueSessionsByStart(filteredOptions),
    [filteredOptions]
  );

  const groupsByDate = useMemo(() => {
    const map = new Map<string, VenueTimeGroup[]>();
    for (const day of days) map.set(day, []);
    for (const group of timeGroups) {
      const date = ymdInTimeZone(group.startsAt, timezone);
      const list = map.get(date);
      if (list) list.push(group);
    }
    return map;
  }, [days, timeGroups, timezone]);

  const { minMinutes, spanMinutes } = useMemo(() => {
    if (timeGroups.length === 0) {
      return { minMinutes: 8 * 60, spanMinutes: 10 * 60 };
    }
    let min = Infinity;
    let max = -Infinity;
    for (const group of timeGroups) {
      min = Math.min(min, minutesFromMidnight(group.startsAt, timezone));
      for (const option of group.options) {
        max = Math.max(max, minutesFromMidnight(option.endsAt, timezone));
      }
    }
    const nextMin = Math.max(0, Math.floor(min / 60) * 60);
    const maxMinutes = Math.min(24 * 60, Math.ceil(max / 60) * 60);
    return {
      minMinutes: nextMin,
      spanMinutes: Math.max(maxMinutes - nextMin, 60),
    };
  }, [timeGroups, timezone]);

  const hourLabels = useMemo(() => {
    const labels: number[] = [];
    for (let m = minMinutes; m < minMinutes + spanMinutes; m += 60) {
      labels.push(m);
    }
    return labels;
  }, [minMinutes, spanMinutes]);

  const rangeLabel = useMemo(() => {
    const endInclusive = addLocalDays(rangeStart, numberOfDays - 1);
    return `${formatDayHeading(rangeStart, timezone, false)} – ${formatDayHeading(endInclusive, timezone, false)}`;
  }, [rangeStart, numberOfDays, timezone]);

  return (
    <div className="space-y-4">
      {coaches.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="venue-availability-coach-filter"
            className="text-xs font-semibold uppercase tracking-wide text-primary/55"
          >
            Coach
          </label>
          <select
            id="venue-availability-coach-filter"
            value={effectiveCoachFilter}
            onChange={(event) => setCoachFilter(event.target.value)}
            className="rounded-xl border border-primary/15 bg-white px-3 py-2 text-sm font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <option value="all">All coaches</option>
            {coaches.map((coach) => (
              <option key={coach.coachId} value={coach.coachId}>
                {coach.coachName}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setRangeStart((current) => addLocalDays(current, -numberOfDays))
            }
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
            onClick={() =>
              setRangeStart((current) => addLocalDays(current, numberOfDays))
            }
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

      {timeGroups.length === 0 ? (
        <p className="rounded-2xl border border-primary/10 bg-surface/50 px-4 py-8 text-center text-sm text-primary/55">
          {emptyMessage}
        </p>
      ) : (
        <>
          <div className="space-y-5 md:hidden">
            {days.map((dateYmd) => {
              const dayGroups = groupsByDate.get(dateYmd) ?? [];
              if (dayGroups.length === 0) return null;
              const isToday = dateYmd === todayYmd;
              return (
                <section
                  key={dateYmd}
                  aria-labelledby={`venue-agenda-${dateYmd}`}
                >
                  <h3
                    id={`venue-agenda-${dateYmd}`}
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
                    {dayGroups.map((group) => (
                      <li key={group.startsAt}>
                        <TimeSummaryBlock
                          group={group}
                          timezone={timezone}
                          variant="agenda"
                          showTooltip={false}
                          onOpen={() => setDialogGroup(group)}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

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
                  </div>
                );
              })}

              <div
                className="relative"
                style={{ height: (spanMinutes / 60) * HOUR_PX }}
              >
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
                const dayGroups = groupsByDate.get(dateYmd) ?? [];
                const isToday = dateYmd === todayYmd;
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
                    {dayGroups.map((group) => {
                      const startMin = minutesFromMidnight(
                        group.startsAt,
                        timezone
                      );
                      const maxEnd = Math.max(
                        ...group.options.map((option) =>
                          minutesFromMidnight(option.endsAt, timezone)
                        )
                      );
                      const top = ((startMin - minMinutes) / 60) * HOUR_PX;
                      const height = Math.max(
                        ((maxEnd - startMin) / 60) * HOUR_PX,
                        MIN_BLOCK_PX
                      );
                      return (
                        <div
                          key={group.startsAt}
                          className="absolute inset-x-1 z-10"
                          style={{ top, height }}
                        >
                          <TimeSummaryBlock
                            group={group}
                            timezone={timezone}
                            variant="grid"
                            showTooltip
                            onOpen={() => setDialogGroup(group)}
                          />
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

      <VenueCoachSelectionDialog
        open={dialogGroup != null}
        group={dialogGroup}
        timezone={timezone}
        mode={context}
        onClose={() => setDialogGroup(null)}
      />
    </div>
  );
}

function TimeSummaryBlock({
  group,
  timezone,
  variant,
  showTooltip,
  onOpen,
}: {
  group: VenueTimeGroup;
  timezone: string;
  variant: "grid" | "agenda";
  showTooltip: boolean;
  onOpen: () => void;
}) {
  const summary = summarizeVenueTimeGroup(group, timezone);
  const [previewOpen, setPreviewOpen] = useState(false);

  const baseClass =
    variant === "grid"
      ? "relative flex h-full w-full flex-col justify-center overflow-visible rounded-lg border border-primary/20 bg-white px-1.5 py-1 text-left text-primary transition hover:border-primary/40 hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
      : "relative flex w-full items-center justify-between gap-3 rounded-xl border border-primary/15 bg-surface px-3 py-2.5 text-left text-sm text-primary transition hover:border-primary/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => showTooltip && setPreviewOpen(true)}
      onMouseLeave={() => setPreviewOpen(false)}
      onFocus={() => showTooltip && setPreviewOpen(true)}
      onBlur={() => setPreviewOpen(false)}
      aria-label={summary.accessibleName}
      className={baseClass}
    >
      {variant === "grid" ? (
        <>
          <span className="block truncate text-[11px] font-bold leading-tight">
            {summary.timeLabel}
          </span>
          <span className="mt-0.5 block truncate text-[10px] font-medium leading-tight opacity-80">
            {summary.coachCountLabel}
          </span>
          {summary.priceLine ? (
            <span className="mt-0.5 block truncate text-[10px] font-semibold leading-tight">
              {summary.priceLine}
            </span>
          ) : null}
        </>
      ) : (
        <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-semibold">{summary.timeLabel}</span>
          <span className="text-xs font-medium opacity-70">
            {summary.coachCountLabel}
          </span>
          {summary.priceLine ? (
            <span className="text-xs font-semibold">{summary.priceLine}</span>
          ) : null}
        </span>
      )}

      {showTooltip && previewOpen ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-full z-40 mt-1 w-max max-w-[14rem] -translate-x-1/2 rounded-xl border border-primary/15 bg-white px-3 py-2 text-left text-xs text-primary shadow-lg"
        >
          <span className="block font-semibold">Available coaches:</span>
          <span className="mt-1 block space-y-0.5">
            {group.options.map((option) => {
              const price = tooltipPrice(option);
              return (
                <span
                  key={`${option.relationshipId}|${option.startsAt}|${option.endsAt}`}
                  className="block"
                >
                  {option.coachName}
                  {price ? ` · ${price}` : ""}
                  {option.visibility === "hidden" ? " · Hidden" : ""}
                  {option.visibility === "reserved" ? " · Reserved" : ""}
                </span>
              );
            })}
          </span>
        </span>
      ) : null}
    </button>
  );
}
