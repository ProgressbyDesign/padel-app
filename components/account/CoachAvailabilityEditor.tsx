"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  createCoachAvailabilityException,
  createCoachAvailabilityRule,
  deleteCoachAvailabilityException,
  deleteCoachAvailabilityRule,
  saveCoachAvailabilitySettings,
  toggleCoachAvailabilityRule,
  updateCoachAvailabilityRule,
} from "@/app/account/coaches/[coachId]/availability-actions";
import {
  ActionButton,
  ConfirmActionButton,
  StatusBadge,
} from "@/components/account/RelationshipActionControls";
import TimezoneCombobox from "@/components/account/TimezoneCombobox";
import {
  AVAILABILITY_DAYS,
  SLOT_DURATION_OPTIONS,
} from "@/lib/coachAvailability/constants";
import type {
  AvailabilityException,
  AvailabilityRule,
  AvailabilitySettings,
  DerivedSlot,
} from "@/lib/coachAvailability/types";
import {
  formatInTimeZone,
  hmInTimeZone,
  todayYmdInTimeZone,
  ymdInTimeZone,
} from "@/lib/coachAvailability/timezone";
import type { ActiveCoachVenueForAvailability } from "@/lib/queries/coachAvailability";

type Props = {
  coachId: string;
  venue: ActiveCoachVenueForAvailability;
  settings: AvailabilitySettings | null;
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  previewSlots: DerivedSlot[];
  suggestedTimezone: string;
  readOnly?: boolean;
  acceptedRanges?: Array<{ startsAt: string; endsAt: string }>;
  requestCounts?: Record<string, number>;
};

function overlapsRange(
  slot: DerivedSlot,
  ranges: Array<{ startsAt: string; endsAt: string }>
) {
  const startMs = new Date(slot.startsAt).getTime();
  const endMs = new Date(slot.endsAt).getTime();
  return ranges.some((range) => {
    const rangeStart = new Date(range.startsAt).getTime();
    const rangeEnd = new Date(range.endsAt).getTime();
    return startMs < rangeEnd && rangeStart < endMs;
  });
}

export default function CoachAvailabilityEditor({
  coachId,
  venue,
  settings,
  rules,
  exceptions,
  previewSlots,
  suggestedTimezone,
  readOnly = false,
  acceptedRanges = [],
  requestCounts = {},
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [timezone, setTimezone] = useState(settings?.timezone ?? "");
  const [duration, setDuration] = useState(
    settings?.default_slot_duration_minutes ?? 60
  );
  const [isPublic, setIsPublic] = useState(settings?.is_public ?? false);

  const tz = settings?.timezone ?? (timezone || suggestedTimezone);
  const defaultValidFrom = todayYmdInTimeZone(tz);

  function applyResult(result: { ok: boolean; message: string }) {
    if (result.ok) {
      setFeedback(result.message);
      setError(null);
      router.refresh();
    } else {
      setError(result.message);
    }
  }

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    setFeedback(null);
    setError(null);
    startTransition(async () => applyResult(await action()));
  }

  const rulesByDay = useMemo(() => {
    const map = new Map<number, AvailabilityRule[]>();
    for (const day of AVAILABILITY_DAYS) map.set(day.dayOfWeek, []);
    for (const rule of rules) {
      const list = map.get(rule.day_of_week) ?? [];
      list.push(rule);
      map.set(rule.day_of_week, list);
    }
    return map;
  }, [rules]);

  const upcomingExceptions = exceptions;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-primary/55">
            <Link
              href={
                readOnly
                  ? `/account/venues/${encodeURIComponent(venue.venueId)}/coaches`
                  : `/account/coaches/${encodeURIComponent(coachId)}/availability`
              }
              className="font-semibold hover:text-primary"
            >
              {readOnly ? "← Coaches" : "← All venues"}
            </Link>
          </p>
          <h2 className="mt-2 text-2xl font-bold text-primary">{venue.venueName}</h2>
          <p className="mt-1 text-sm text-primary/60">
            {[venue.city, venue.country].filter(Boolean).join(", ") ||
              "Schedule for this coaching venue"}
          </p>
        </div>
        {readOnly ? <StatusBadge tone="amber">View only</StatusBadge> : null}
      </div>

      {(feedback || error) && (
        <div
          role="status"
          className={`rounded-xl px-4 py-3 text-sm ${
            error ? "bg-red-50 text-red-900" : "bg-emerald-50 text-emerald-900"
          }`}
        >
          {error ?? feedback}
        </div>
      )}

      <section className="rounded-[24px] border border-primary/10 bg-white p-5 sm:p-6">
        <h3 className="text-lg font-bold text-primary">Availability settings</h3>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <TimezoneCombobox
            value={timezone}
            suggested={suggestedTimezone}
            disabled={readOnly}
            onChange={setTimezone}
          />
          <div>
            <label className="block text-sm font-semibold text-primary">
              Default session duration
              <select
                value={duration}
                disabled={readOnly}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="mt-2 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2.5 text-sm font-normal"
              >
                {SLOT_DURATION_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option} minutes
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-4 flex items-start gap-3 text-sm text-primary/80">
              <input
                type="checkbox"
                checked={isPublic}
                disabled={readOnly}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="mt-1"
              />
              <span>
                Show my availability on my public coach and venue profiles
              </span>
            </label>
          </div>
        </div>
        {!readOnly ? (
          <div className="mt-5">
            <ActionButton
              pending={pending || !timezone}
              onClick={() =>
                run(() =>
                  saveCoachAvailabilitySettings({
                    coachId,
                    relationshipId: venue.relationshipId,
                    timezone,
                    defaultSlotDurationMinutes: duration,
                    isPublic,
                  })
                )
              }
            >
              Save settings
            </ActionButton>
          </div>
        ) : null}
      </section>

      <section className="rounded-[24px] border border-primary/10 bg-white p-5 sm:p-6">
        <h3 className="text-lg font-bold text-primary">Weekly schedule</h3>
        <p className="mt-1 text-sm text-primary/60">
          Times are in {settings?.timezone ?? "the selected timezone"}. Save settings
          before adding hours.
        </p>

        <div className="mt-5 space-y-3">
          {AVAILABILITY_DAYS.map((day) => {
            const dayRules = rulesByDay.get(day.dayOfWeek) ?? [];
            return (
              <details
                key={day.dayOfWeek}
                className="rounded-2xl border border-primary/10 bg-surface/40 open:bg-white"
                open={dayRules.length > 0}
              >
                <summary className="cursor-pointer list-none px-4 py-3 font-semibold text-primary">
                  <span className="flex items-center justify-between gap-3">
                    <span>{day.label}</span>
                    <span className="text-xs font-medium text-primary/50">
                      {dayRules.length === 0
                        ? "Unavailable"
                        : dayRules
                            .map(
                              (rule) =>
                                `${rule.start_time}–${rule.end_time}`
                            )
                            .join(", ")}
                    </span>
                  </span>
                </summary>
                <div className="space-y-3 border-t border-primary/10 px-4 py-4">
                  {dayRules.map((rule) => (
                    <RuleRow
                      key={rule.id}
                      rule={rule}
                      readOnly={readOnly}
                      pending={pending}
                      defaultDuration={settings?.default_slot_duration_minutes ?? duration}
                      onSave={(payload) =>
                        run(() =>
                          updateCoachAvailabilityRule({
                            coachId,
                            relationshipId: venue.relationshipId,
                            ruleId: rule.id,
                            ...payload,
                          })
                        )
                      }
                      onToggle={(isActive) =>
                        run(() =>
                          toggleCoachAvailabilityRule({
                            coachId,
                            relationshipId: venue.relationshipId,
                            ruleId: rule.id,
                            isActive,
                          })
                        )
                      }
                      onDelete={() =>
                        deleteCoachAvailabilityRule({
                          coachId,
                          relationshipId: venue.relationshipId,
                          ruleId: rule.id,
                        })
                      }
                      onDeleted={applyResult}
                      onCopy={() => {
                        if (readOnly) return;
                        const targets = AVAILABILITY_DAYS.filter(
                          (d) => d.dayOfWeek !== day.dayOfWeek
                        );
                        startTransition(async () => {
                          for (const target of targets) {
                            const result = await createCoachAvailabilityRule({
                              coachId,
                              relationshipId: venue.relationshipId,
                              dayOfWeek: target.dayOfWeek,
                              startTime: rule.start_time,
                              endTime: rule.end_time,
                              slotDurationMinutes: rule.slot_duration_minutes,
                              validFrom: rule.valid_from,
                              validUntil: rule.valid_until,
                              isActive: rule.is_active,
                            });
                            if (!result.ok) {
                              applyResult(result);
                              return;
                            }
                          }
                          applyResult({
                            ok: true,
                            message: `Copied ${day.label} hours to other days.`,
                          });
                        });
                      }}
                    />
                  ))}
                  {!readOnly && settings ? (
                    <AddRuleForm
                      dayOfWeek={day.dayOfWeek}
                      defaultDuration={settings.default_slot_duration_minutes}
                      defaultValidFrom={defaultValidFrom}
                      pending={pending}
                      onAdd={(payload) =>
                        run(() =>
                          createCoachAvailabilityRule({
                            coachId,
                            relationshipId: venue.relationshipId,
                            ...payload,
                          })
                        )
                      }
                    />
                  ) : null}
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <section className="rounded-[24px] border border-primary/10 bg-white p-5 sm:p-6">
        <h3 className="text-lg font-bold text-primary">Date exceptions</h3>
        <p className="mt-1 text-sm text-primary/60">
          Time off removes slots. Extra availability adds slots. Interpreted in{" "}
          {settings?.timezone ?? "the schedule timezone"}.
        </p>

        {!readOnly && settings ? (
          <ExceptionForm
            pending={pending}
            defaultDuration={settings.default_slot_duration_minutes}
            defaultDate={defaultValidFrom}
            onCreate={(payload) =>
              run(() =>
                createCoachAvailabilityException({
                  coachId,
                  relationshipId: venue.relationshipId,
                  ...payload,
                })
              )
            }
          />
        ) : null}

        <ul className="mt-5 space-y-3">
          {upcomingExceptions.length === 0 ? (
            <li className="text-sm text-primary/55">No upcoming exceptions.</li>
          ) : (
            upcomingExceptions.map((exception) => (
              <li
                key={exception.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/10 bg-surface/50 px-4 py-3"
              >
                <div>
                  <StatusBadge
                    tone={
                      exception.exception_type === "unavailable" ? "red" : "green"
                    }
                  >
                    {exception.exception_type === "unavailable"
                      ? "Time off"
                      : "Extra availability"}
                  </StatusBadge>
                  <p className="mt-2 text-sm font-semibold text-primary">
                    {settings
                      ? `${ymdInTimeZone(exception.starts_at, settings.timezone)} ${hmInTimeZone(exception.starts_at, settings.timezone)} – ${hmInTimeZone(exception.ends_at, settings.timezone)}`
                      : `${exception.starts_at} – ${exception.ends_at}`}
                  </p>
                </div>
                {!readOnly ? (
                  <ConfirmActionButton
                    label="Delete"
                    confirmLabel="Confirm delete"
                    onConfirm={() =>
                      deleteCoachAvailabilityException({
                        coachId,
                        relationshipId: venue.relationshipId,
                        exceptionId: exception.id,
                      })
                    }
                    onDone={applyResult}
                  />
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-[24px] border border-primary/10 bg-white p-5 sm:p-6">
        <h3 className="text-lg font-bold text-primary">Public preview</h3>
        <p className="mt-1 text-sm text-primary/60">
          Next 14 days of derived sessions
          {settings?.is_public ? " (public)" : " (private — not shown publicly)"}.
        </p>
        {previewSlots.length === 0 ? (
          <p className="mt-4 text-sm text-primary/55">No upcoming sessions.</p>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {previewSlots.slice(0, 24).map((slot) => {
              const key = `${slot.startsAt}|${slot.endsAt}`;
              const isAccepted = overlapsRange(slot, acceptedRanges);
              const requestCount = requestCounts[key] ?? 0;
              return (
                <li
                  key={key}
                  className="rounded-xl border border-primary/10 bg-surface/60 px-3 py-2 text-sm text-primary"
                >
                  <p>
                    {formatInTimeZone(slot.startsAt, slot.timezone, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      hourCycle: "h23",
                    })}
                  </p>
                  {isAccepted ? (
                    <p className="mt-1 text-xs font-semibold text-emerald-800">
                      {readOnly ? "Reserved" : "Confirmed"}
                    </p>
                  ) : null}
                  {!readOnly && !isAccepted && requestCount > 0 ? (
                    <p className="mt-1 text-xs font-semibold text-amber-900">
                      {requestCount === 1
                        ? "1 request"
                        : `${requestCount} requests`}
                    </p>
                  ) : null}
                  {!readOnly && !isAccepted && requestCount > 0 ? (
                    <Link
                      href={`/account/coaches/${encodeURIComponent(
                        coachId
                      )}/bookings`}
                      className="mt-1 inline-block text-xs font-semibold text-primary/70 hover:text-primary"
                    >
                      Review requests
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function RuleRow({
  rule,
  readOnly,
  pending,
  defaultDuration,
  onSave,
  onToggle,
  onDelete,
  onDeleted,
  onCopy,
}: {
  rule: AvailabilityRule;
  readOnly: boolean;
  pending: boolean;
  defaultDuration: number;
  onSave: (payload: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    slotDurationMinutes: number;
    validFrom: string;
    validUntil: string | null;
    isActive: boolean;
  }) => void;
  onToggle: (isActive: boolean) => void;
  onDelete: () => Promise<{ ok: boolean; message: string }>;
  onDeleted: (result: { ok: boolean; message: string }) => void;
  onCopy: () => void;
}) {
  const [startTime, setStartTime] = useState(rule.start_time);
  const [endTime, setEndTime] = useState(rule.end_time);
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(
    rule.slot_duration_minutes || defaultDuration
  );
  const [validFrom, setValidFrom] = useState(rule.valid_from);
  const [validUntil, setValidUntil] = useState(rule.valid_until ?? "");

  return (
    <fieldset className="rounded-xl border border-primary/10 bg-white p-3">
      <legend className="px-1 text-xs font-semibold text-primary/50">
        {rule.is_active ? "Active window" : "Paused window"}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold text-primary/70">
          Start
          <input
            type="time"
            value={startTime}
            disabled={readOnly}
            onChange={(e) => setStartTime(e.target.value)}
            className="mt-1 w-full rounded-lg border border-primary/15 px-2 py-2 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-semibold text-primary/70">
          End
          <input
            type="time"
            value={endTime}
            disabled={readOnly}
            onChange={(e) => setEndTime(e.target.value)}
            className="mt-1 w-full rounded-lg border border-primary/15 px-2 py-2 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-semibold text-primary/70">
          Session
          <select
            value={slotDurationMinutes}
            disabled={readOnly}
            onChange={(e) => setSlotDurationMinutes(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-primary/15 px-2 py-2 text-sm font-normal"
          >
            {SLOT_DURATION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} min
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-primary/70">
          Valid from
          <input
            type="date"
            value={validFrom}
            disabled={readOnly}
            onChange={(e) => setValidFrom(e.target.value)}
            className="mt-1 w-full rounded-lg border border-primary/15 px-2 py-2 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-semibold text-primary/70 sm:col-span-2">
          Valid until (optional)
          <input
            type="date"
            value={validUntil}
            disabled={readOnly}
            onChange={(e) => setValidUntil(e.target.value)}
            className="mt-1 w-full rounded-lg border border-primary/15 px-2 py-2 text-sm font-normal"
          />
        </label>
      </div>
      {!readOnly ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <ActionButton
            pending={pending}
            onClick={() =>
              onSave({
                dayOfWeek: rule.day_of_week,
                startTime,
                endTime,
                slotDurationMinutes,
                validFrom,
                validUntil: validUntil || null,
                isActive: rule.is_active,
              })
            }
          >
            Save window
          </ActionButton>
          <ActionButton
            tone="secondary"
            pending={pending}
            onClick={() => onToggle(!rule.is_active)}
          >
            {rule.is_active ? "Pause" : "Activate"}
          </ActionButton>
          <ActionButton tone="secondary" pending={pending} onClick={onCopy}>
            Copy to other days
          </ActionButton>
          <ConfirmActionButton
            label="Remove"
            confirmLabel="Confirm remove"
            onConfirm={onDelete}
            onDone={onDeleted}
          />
        </div>
      ) : null}
    </fieldset>
  );
}

function AddRuleForm({
  dayOfWeek,
  defaultDuration,
  defaultValidFrom,
  pending,
  onAdd,
}: {
  dayOfWeek: number;
  defaultDuration: number;
  defaultValidFrom: string;
  pending: boolean;
  onAdd: (payload: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    slotDurationMinutes: number;
    validFrom: string;
    validUntil: string | null;
    isActive: boolean;
  }) => void;
}) {
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(defaultDuration);
  const [validFrom, setValidFrom] = useState(defaultValidFrom);
  const [validUntil, setValidUntil] = useState("");

  return (
    <div className="rounded-xl border border-dashed border-primary/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary/45">
        Add time window
      </p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold text-primary/70">
          Start
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="mt-1 w-full rounded-lg border border-primary/15 px-2 py-2 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-semibold text-primary/70">
          End
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="mt-1 w-full rounded-lg border border-primary/15 px-2 py-2 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-semibold text-primary/70">
          Session
          <select
            value={slotDurationMinutes}
            onChange={(e) => setSlotDurationMinutes(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-primary/15 px-2 py-2 text-sm font-normal"
          >
            {SLOT_DURATION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} min
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-primary/70">
          Valid from
          <input
            type="date"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            className="mt-1 w-full rounded-lg border border-primary/15 px-2 py-2 text-sm font-normal"
          />
        </label>
      </div>
      <label className="mt-3 block text-xs font-semibold text-primary/70">
        Valid until (optional)
        <input
          type="date"
          value={validUntil}
          onChange={(e) => setValidUntil(e.target.value)}
          className="mt-1 w-full max-w-xs rounded-lg border border-primary/15 px-2 py-2 text-sm font-normal"
        />
      </label>
      <div className="mt-3">
        <ActionButton
          pending={pending}
          onClick={() =>
            onAdd({
              dayOfWeek,
              startTime,
              endTime,
              slotDurationMinutes,
              validFrom,
              validUntil: validUntil || null,
              isActive: true,
            })
          }
        >
          + Add time window
        </ActionButton>
      </div>
    </div>
  );
}

function ExceptionForm({
  pending,
  defaultDuration,
  defaultDate,
  onCreate,
}: {
  pending: boolean;
  defaultDuration: number;
  defaultDate: string;
  onCreate: (payload: {
    exceptionType: "unavailable" | "available";
    dateYmd: string;
    startTime: string;
    endTime: string;
    allDay?: boolean;
    slotDurationMinutes: number | null;
  }) => void;
}) {
  const [exceptionType, setExceptionType] = useState<"unavailable" | "available">(
    "unavailable"
  );
  const [dateYmd, setDateYmd] = useState(defaultDate);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [allDay, setAllDay] = useState(false);
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(defaultDuration);

  return (
    <div className="mt-4 rounded-2xl border border-primary/10 bg-surface/50 p-4">
      <div className="flex flex-wrap gap-2">
        <ActionButton
          tone={exceptionType === "unavailable" ? "primary" : "secondary"}
          pending={pending}
          onClick={() => setExceptionType("unavailable")}
        >
          Time off
        </ActionButton>
        <ActionButton
          tone={exceptionType === "available" ? "primary" : "secondary"}
          pending={pending}
          onClick={() => setExceptionType("available")}
        >
          Extra availability
        </ActionButton>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold text-primary/70">
          Date
          <input
            type="date"
            value={dateYmd}
            onChange={(e) => setDateYmd(e.target.value)}
            className="mt-1 w-full rounded-lg border border-primary/15 px-2 py-2 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-semibold text-primary/70">
          Start
          <input
            type="time"
            value={startTime}
            disabled={allDay}
            onChange={(e) => setStartTime(e.target.value)}
            className="mt-1 w-full rounded-lg border border-primary/15 px-2 py-2 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-semibold text-primary/70">
          End
          <input
            type="time"
            value={endTime}
            disabled={allDay}
            onChange={(e) => setEndTime(e.target.value)}
            className="mt-1 w-full rounded-lg border border-primary/15 px-2 py-2 text-sm font-normal"
          />
        </label>
        {exceptionType === "available" ? (
          <label className="text-xs font-semibold text-primary/70">
            Session
            <select
              value={slotDurationMinutes}
              onChange={(e) => setSlotDurationMinutes(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-primary/15 px-2 py-2 text-sm font-normal"
            >
              {SLOT_DURATION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option} min
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="flex items-center gap-2 text-xs font-semibold text-primary/70">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
            />
            All day
          </label>
        )}
      </div>
      <div className="mt-3">
        <ActionButton
          pending={pending}
          onClick={() =>
            onCreate({
              exceptionType,
              dateYmd,
              startTime,
              endTime,
              allDay: exceptionType === "unavailable" ? allDay : false,
              slotDurationMinutes:
                exceptionType === "unavailable" ? null : slotDurationMinutes,
            })
          }
        >
          Add exception
        </ActionButton>
      </div>
    </div>
  );
}
