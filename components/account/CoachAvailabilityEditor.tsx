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
import AvailabilityCalendar, {
  type CalendarSlot,
} from "@/components/availability/AvailabilityCalendar";
import {
  AVAILABILITY_DAYS,
  SLOT_DURATION_OPTIONS,
} from "@/lib/coachAvailability/constants";
import {
  SUPPORTED_CURRENCIES,
  calculateSessionPrice,
  formatMoney,
  minorToDecimalString,
  parseMoneyToMinor,
} from "@/lib/coachAvailability/pricing";
import type {
  AvailabilityException,
  AvailabilityRule,
  AvailabilitySettings,
  DerivedSlot,
} from "@/lib/coachAvailability/types";
import {
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

type RuleSavePayload = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
  priceOverrideMinor: number | null;
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

function resolveOverrideMinor(
  useOverride: boolean,
  overrideDecimal: string,
  currency: string | null | undefined
): { ok: true; minor: number | null } | { ok: false; message: string } {
  if (!useOverride || !overrideDecimal.trim()) {
    return { ok: true, minor: null };
  }
  if (!currency) {
    return {
      ok: false,
      message: "Set a currency in availability settings before adding a session price.",
    };
  }
  const parsed = parseMoneyToMinor(overrideDecimal, currency);
  if (!parsed.ok) return parsed;
  return { ok: true, minor: parsed.minor };
}

function sessionPriceLabel(
  overrideMinor: number | null | undefined,
  durationMinutes: number,
  currency: string | null | undefined,
  defaultHourlyRateMinor: number | null | undefined
) {
  if (overrideMinor != null) {
    return formatMoney(overrideMinor, currency);
  }
  return formatMoney(
    calculateSessionPrice(defaultHourlyRateMinor, durationMinutes),
    currency
  );
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
  const [currency, setCurrency] = useState(settings?.currency ?? "");
  const [defaultHourlyRate, setDefaultHourlyRate] = useState(
    minorToDecimalString(settings?.default_hourly_rate_minor)
  );

  const tz = settings?.timezone ?? (timezone || suggestedTimezone);
  const defaultValidFrom = todayYmdInTimeZone(tz);
  const pricingCurrency = settings?.currency ?? null;
  const pricingHourlyMinor = settings?.default_hourly_rate_minor ?? null;

  function setLocalError(message: string | null) {
    setFeedback(null);
    setError(message);
  }

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

  function runAndReturn(
    action: () => Promise<{ ok: boolean; message: string }>
  ): Promise<{ ok: boolean; message: string }> {
    setFeedback(null);
    setError(null);
    return new Promise((resolve) => {
      startTransition(async () => {
        const result = await action();
        applyResult(result);
        resolve(result);
      });
    });
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

  const previewCalendarSlots = useMemo((): CalendarSlot[] => {
    return previewSlots.map((slot) => {
      const key = `${slot.startsAt}|${slot.endsAt}`;
      const isAccepted = overlapsRange(slot, acceptedRanges);
      const requestCount = requestCounts[key] ?? 0;
      let state: CalendarSlot["state"] = "available";
      if (isAccepted) {
        state = readOnly ? "reserved" : "confirmed";
      } else if (!readOnly && requestCount > 0) {
        state = "requested";
      }
      return {
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        timezone: slot.timezone,
        venueId: slot.venueId,
        venueName: slot.venueName,
        priceAmountMinor: slot.priceAmountMinor,
        currency: slot.currency,
        state,
        requestedCount: !readOnly && !isAccepted ? requestCount : undefined,
        href:
          !readOnly && !isAccepted && requestCount > 0
            ? `/account/coaches/${encodeURIComponent(coachId)}/bookings`
            : undefined,
      };
    });
  }, [previewSlots, acceptedRanges, requestCounts, readOnly, coachId]);

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

        <div className="mt-6 border-t border-primary/10 pt-5">
          <h4 className="text-sm font-bold text-primary">Pricing</h4>
          <p className="mt-1 text-sm text-primary/60">
            Default hourly rate is used to calculate session prices from each
            window&apos;s duration. Payment is arranged directly with the coach.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-primary">
              Currency
              <select
                value={currency}
                disabled={readOnly}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-2 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2.5 text-sm font-normal"
              >
                <option value="">No price listed</option>
                {SUPPORTED_CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-primary">
              Default hourly rate
              <input
                type="text"
                inputMode="decimal"
                placeholder="e.g. 40.00"
                value={defaultHourlyRate}
                disabled={readOnly}
                onChange={(e) => setDefaultHourlyRate(e.target.value)}
                className="mt-2 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2.5 text-sm font-normal"
              />
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
                    currency,
                    defaultHourlyRate,
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
                      key={`${rule.id}-${rule.updated_at}`}
                      rule={rule}
                      readOnly={readOnly}
                      pending={pending}
                      defaultDuration={settings?.default_slot_duration_minutes ?? duration}
                      currency={pricingCurrency}
                      defaultHourlyRateMinor={pricingHourlyMinor}
                      onSave={(payload) =>
                        runAndReturn(() =>
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
                      onLocalError={setLocalError}
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
                              priceOverrideMinor: rule.price_override_minor,
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
                      currency={pricingCurrency}
                      defaultHourlyRateMinor={pricingHourlyMinor}
                      onAdd={(payload) =>
                        run(() =>
                          createCoachAvailabilityRule({
                            coachId,
                            relationshipId: venue.relationshipId,
                            ...payload,
                          })
                        )
                      }
                      onLocalError={setLocalError}
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
            currency={pricingCurrency}
            defaultHourlyRateMinor={pricingHourlyMinor}
            onCreate={(payload) =>
              run(() =>
                createCoachAvailabilityException({
                  coachId,
                  relationshipId: venue.relationshipId,
                  ...payload,
                })
              )
            }
            onLocalError={setLocalError}
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
                  {exception.exception_type === "available" ? (
                    <p className="mt-1 text-xs text-primary/55">
                      {sessionPriceLabel(
                        exception.price_override_minor,
                        exception.slot_duration_minutes ??
                          settings?.default_slot_duration_minutes ??
                          60,
                        pricingCurrency,
                        pricingHourlyMinor
                      )}
                    </p>
                  ) : null}
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
        <h3 className="text-lg font-bold text-primary">
          {readOnly ? "Availability calendar" : "Public preview"}
        </h3>
        <p className="mt-1 text-sm text-primary/60">
          Next sessions derived from your schedule
          {settings?.is_public ? " (public)" : " (private — not shown publicly)"}.
        </p>
        <div className="mt-4">
          <AvailabilityCalendar
            slots={previewCalendarSlots}
            timezone={tz}
            context={readOnly ? "venue_preview" : "coach_preview"}
            selectable={false}
          />
        </div>
      </section>
    </div>
  );
}

function PriceOverrideFields({
  useOverride,
  onUseOverrideChange,
  overrideDecimal,
  onOverrideDecimalChange,
  durationMinutes,
  currency,
  defaultHourlyRateMinor,
  disabled,
}: {
  useOverride: boolean;
  onUseOverrideChange: (value: boolean) => void;
  overrideDecimal: string;
  onOverrideDecimalChange: (value: string) => void;
  durationMinutes: number;
  currency: string | null | undefined;
  defaultHourlyRateMinor: number | null | undefined;
  disabled?: boolean;
}) {
  const calculated = calculateSessionPrice(defaultHourlyRateMinor, durationMinutes);
  return (
    <div className="rounded-lg border border-primary/10 bg-surface/40 px-3 py-3">
      <p className="text-xs text-primary/60">
        Calculated session price:{" "}
        <span className="font-semibold text-primary">
          {formatMoney(calculated, currency)}
        </span>
        {currency && defaultHourlyRateMinor != null
          ? ` (${formatMoney(defaultHourlyRateMinor, currency)}/hr × ${durationMinutes} min)`
          : null}
      </p>
      <label className="mt-3 flex items-start gap-2 text-xs font-semibold text-primary/70">
        <input
          type="checkbox"
          checked={useOverride}
          disabled={disabled}
          onChange={(e) => onUseOverrideChange(e.target.checked)}
          className="mt-0.5"
        />
        <span>Set a different price for this session length</span>
      </label>
      {useOverride ? (
        <label className="mt-2 block text-xs font-semibold text-primary/70">
          Total session price
          <input
            type="text"
            inputMode="decimal"
            placeholder="e.g. 60.00"
            value={overrideDecimal}
            disabled={disabled}
            onChange={(e) => onOverrideDecimalChange(e.target.value)}
            className="mt-1 w-full max-w-xs rounded-lg border border-primary/15 px-2 py-2 text-sm font-normal"
          />
        </label>
      ) : null}
    </div>
  );
}

function RuleRow({
  rule,
  readOnly,
  pending,
  defaultDuration,
  currency,
  defaultHourlyRateMinor,
  onSave,
  onToggle,
  onDelete,
  onDeleted,
  onLocalError,
  onCopy,
}: {
  rule: AvailabilityRule;
  readOnly: boolean;
  pending: boolean;
  defaultDuration: number;
  currency: string | null | undefined;
  defaultHourlyRateMinor: number | null | undefined;
  onSave: (payload: RuleSavePayload) => Promise<{ ok: boolean; message: string }>;
  onToggle: (isActive: boolean) => void;
  onDelete: () => Promise<{ ok: boolean; message: string }>;
  onDeleted: (result: { ok: boolean; message: string }) => void;
  onLocalError: (message: string | null) => void;
  onCopy: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [startTime, setStartTime] = useState(rule.start_time);
  const [endTime, setEndTime] = useState(rule.end_time);
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(
    rule.slot_duration_minutes || defaultDuration
  );
  const [validFrom, setValidFrom] = useState(rule.valid_from);
  const [validUntil, setValidUntil] = useState(rule.valid_until ?? "");
  const [useOverride, setUseOverride] = useState(rule.price_override_minor != null);
  const [overrideDecimal, setOverrideDecimal] = useState(
    minorToDecimalString(rule.price_override_minor)
  );

  function syncFromRule() {
    setStartTime(rule.start_time);
    setEndTime(rule.end_time);
    setSlotDurationMinutes(rule.slot_duration_minutes || defaultDuration);
    setValidFrom(rule.valid_from);
    setValidUntil(rule.valid_until ?? "");
    setUseOverride(rule.price_override_minor != null);
    setOverrideDecimal(minorToDecimalString(rule.price_override_minor));
  }

  const summaryPrice = sessionPriceLabel(
    rule.price_override_minor,
    rule.slot_duration_minutes || defaultDuration,
    currency,
    defaultHourlyRateMinor
  );
  const validity =
    rule.valid_until != null
      ? `${rule.valid_from} → ${rule.valid_until}`
      : `from ${rule.valid_from}`;

  if (!editing) {
    return (
      <div className="rounded-xl border border-primary/10 bg-white px-3 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-primary">
              {rule.start_time}–{rule.end_time}
              <span className="font-normal text-primary/45"> · </span>
              {rule.slot_duration_minutes} min
              <span className="font-normal text-primary/45"> · </span>
              {summaryPrice}
            </p>
            <p className="mt-1 text-xs text-primary/55">
              {rule.is_active ? "Active" : "Paused"} · {validity}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!readOnly ? (
              <>
                <ActionButton
                  tone="secondary"
                  pending={pending}
                  onClick={() => {
                    syncFromRule();
                    setEditing(true);
                  }}
                >
                  Edit
                </ActionButton>
                <ActionButton tone="secondary" pending={pending} onClick={onCopy}>
                  Copy
                </ActionButton>
                <ActionButton
                  tone="secondary"
                  pending={pending}
                  onClick={() => onToggle(!rule.is_active)}
                >
                  {rule.is_active ? "Pause" : "Resume"}
                </ActionButton>
                <ConfirmActionButton
                  label="Remove"
                  confirmLabel="Confirm remove"
                  onConfirm={onDelete}
                  onDone={onDeleted}
                />
              </>
            ) : (
              <ActionButton
                tone="secondary"
                pending={false}
                onClick={() => {
                  syncFromRule();
                  setEditing(true);
                }}
              >
                View
              </ActionButton>
            )}
          </div>
        </div>
      </div>
    );
  }

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

      <div className="mt-3">
        <PriceOverrideFields
          useOverride={useOverride}
          onUseOverrideChange={setUseOverride}
          overrideDecimal={overrideDecimal}
          onOverrideDecimalChange={setOverrideDecimal}
          durationMinutes={slotDurationMinutes}
          currency={currency}
          defaultHourlyRateMinor={defaultHourlyRateMinor}
          disabled={readOnly}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {!readOnly ? (
          <>
            <ActionButton
              pending={pending || saving}
              onClick={() => {
                const override = resolveOverrideMinor(
                  useOverride,
                  overrideDecimal,
                  currency
                );
                if (!override.ok) {
                  onLocalError(override.message);
                  return;
                }
                onLocalError(null);
                setSaving(true);
                void onSave({
                  dayOfWeek: rule.day_of_week,
                  startTime,
                  endTime,
                  slotDurationMinutes,
                  validFrom,
                  validUntil: validUntil || null,
                  isActive: rule.is_active,
                  priceOverrideMinor: override.minor,
                }).then((result) => {
                  setSaving(false);
                  if (result.ok) setEditing(false);
                });
              }}
            >
              Save window
            </ActionButton>
            <ActionButton
              tone="secondary"
              pending={pending || saving}
              onClick={() => {
                syncFromRule();
                setEditing(false);
              }}
            >
              Cancel
            </ActionButton>
          </>
        ) : (
          <ActionButton
            tone="secondary"
            pending={false}
            onClick={() => {
              syncFromRule();
              setEditing(false);
            }}
          >
            Close
          </ActionButton>
        )}
      </div>
    </fieldset>
  );
}

function AddRuleForm({
  dayOfWeek,
  defaultDuration,
  defaultValidFrom,
  pending,
  currency,
  defaultHourlyRateMinor,
  onAdd,
  onLocalError,
}: {
  dayOfWeek: number;
  defaultDuration: number;
  defaultValidFrom: string;
  pending: boolean;
  currency: string | null | undefined;
  defaultHourlyRateMinor: number | null | undefined;
  onAdd: (payload: RuleSavePayload) => void;
  onLocalError: (message: string | null) => void;
}) {
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(defaultDuration);
  const [validFrom, setValidFrom] = useState(defaultValidFrom);
  const [validUntil, setValidUntil] = useState("");
  const [useOverride, setUseOverride] = useState(false);
  const [overrideDecimal, setOverrideDecimal] = useState("");

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
        <PriceOverrideFields
          useOverride={useOverride}
          onUseOverrideChange={setUseOverride}
          overrideDecimal={overrideDecimal}
          onOverrideDecimalChange={setOverrideDecimal}
          durationMinutes={slotDurationMinutes}
          currency={currency}
          defaultHourlyRateMinor={defaultHourlyRateMinor}
        />
      </div>
      <div className="mt-3">
        <ActionButton
          pending={pending}
          onClick={() => {
            const override = resolveOverrideMinor(
              useOverride,
              overrideDecimal,
              currency
            );
            if (!override.ok) {
              onLocalError(override.message);
              return;
            }
            onLocalError(null);
            onAdd({
              dayOfWeek,
              startTime,
              endTime,
              slotDurationMinutes,
              validFrom,
              validUntil: validUntil || null,
              isActive: true,
              priceOverrideMinor: override.minor,
            });
          }}
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
  currency,
  defaultHourlyRateMinor,
  onCreate,
  onLocalError,
}: {
  pending: boolean;
  defaultDuration: number;
  defaultDate: string;
  currency: string | null | undefined;
  defaultHourlyRateMinor: number | null | undefined;
  onCreate: (payload: {
    exceptionType: "unavailable" | "available";
    dateYmd: string;
    startTime: string;
    endTime: string;
    allDay?: boolean;
    slotDurationMinutes: number | null;
    priceOverrideMinor: number | null;
  }) => void;
  onLocalError: (message: string | null) => void;
}) {
  const [exceptionType, setExceptionType] = useState<"unavailable" | "available">(
    "unavailable"
  );
  const [dateYmd, setDateYmd] = useState(defaultDate);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [allDay, setAllDay] = useState(false);
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(defaultDuration);
  const [useOverride, setUseOverride] = useState(false);
  const [overrideDecimal, setOverrideDecimal] = useState("");

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
      {exceptionType === "available" ? (
        <div className="mt-3">
          <PriceOverrideFields
            useOverride={useOverride}
            onUseOverrideChange={setUseOverride}
            overrideDecimal={overrideDecimal}
            onOverrideDecimalChange={setOverrideDecimal}
            durationMinutes={slotDurationMinutes}
            currency={currency}
            defaultHourlyRateMinor={defaultHourlyRateMinor}
          />
        </div>
      ) : null}
      <div className="mt-3">
        <ActionButton
          pending={pending}
          onClick={() => {
            if (exceptionType === "unavailable") {
              onLocalError(null);
              onCreate({
                exceptionType,
                dateYmd,
                startTime,
                endTime,
                allDay,
                slotDurationMinutes: null,
                priceOverrideMinor: null,
              });
              return;
            }
            const override = resolveOverrideMinor(
              useOverride,
              overrideDecimal,
              currency
            );
            if (!override.ok) {
              onLocalError(override.message);
              return;
            }
            onLocalError(null);
            onCreate({
              exceptionType,
              dateYmd,
              startTime,
              endTime,
              allDay: false,
              slotDurationMinutes,
              priceOverrideMinor: override.minor,
            });
          }}
        >
          Add exception
        </ActionButton>
      </div>
    </div>
  );
}
