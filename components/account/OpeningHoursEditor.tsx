"use client";

import { useState } from "react";
import {
  getStructuredOpeningHours,
  OPENING_HOURS_STATUSES,
  WEEKDAYS,
  type OpeningHoursStatus,
  type StructuredOpeningHours,
  type WeekdayKey,
} from "@/lib/openingHours";

type DraftStatus = OpeningHoursStatus | "";
type DayDraft = {
  status: DraftStatus;
  opens: string;
  closes: string;
};
type HoursDraft = Record<WeekdayKey, DayDraft>;

function emptyDraft(): HoursDraft {
  return Object.fromEntries(
    WEEKDAYS.map(({ key }) => [
      key,
      { status: "", opens: "", closes: "" },
    ])
  ) as HoursDraft;
}

function draftFromStructured(hours: StructuredOpeningHours): HoursDraft {
  return Object.fromEntries(
    WEEKDAYS.map(({ key }) => [
      key,
      {
        status: hours[key].status,
        opens: hours[key].opens ?? "",
        closes: hours[key].closes ?? "",
      },
    ])
  ) as HoursDraft;
}

function permissiveDraft(raw: string): HoursDraft {
  const strict = getStructuredOpeningHours(raw);
  if (strict) return draftFromStructured(strict);

  try {
    const input = JSON.parse(raw) as Record<string, unknown>;
    const draft = emptyDraft();
    for (const { key } of WEEKDAYS) {
      const value = input?.[key];
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const day = value as Record<string, unknown>;
      const status =
        typeof day.status === "string" &&
        (OPENING_HOURS_STATUSES as readonly string[]).includes(day.status)
          ? (day.status as OpeningHoursStatus)
          : "";
      draft[key] = {
        status,
        opens: typeof day.opens === "string" ? day.opens : "",
        closes: typeof day.closes === "string" ? day.closes : "",
      };
    }
    return draft;
  } catch {
    return emptyDraft();
  }
}

function submissionJson(draft: HoursDraft): string {
  return JSON.stringify(
    Object.fromEntries(
      WEEKDAYS.map(({ key }) => {
        const day = draft[key];
        return [
          key,
          {
            status: day.status,
            opens: day.status === "open" ? day.opens || null : null,
            closes: day.status === "open" ? day.closes || null : null,
          },
        ];
      })
    )
  );
}

export default function OpeningHoursEditor({
  initialJson,
  legacyText,
  invalid,
  describedBy,
}: {
  initialJson: string;
  legacyText: string | null;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [draft, setDraft] = useState<HoursDraft>(() =>
    initialJson ? permissiveDraft(initialJson) : emptyDraft()
  );

  function updateDay(day: WeekdayKey, patch: Partial<DayDraft>) {
    setDraft((current) => ({
      ...current,
      [day]: { ...current[day], ...patch },
    }));
  }

  function copyMonday() {
    const monday = { ...draft.monday };
    if (!monday.status) return;
    setDraft(
      Object.fromEntries(
        WEEKDAYS.map(({ key }) => [key, { ...monday }])
      ) as HoursDraft
    );
  }

  return (
    <fieldset
      className="rounded-2xl border border-primary/10 bg-surface/70 p-4 sm:p-5"
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
    >
      <input
        type="hidden"
        name="opening_hours_structured"
        value={submissionJson(draft)}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <legend className="text-base font-semibold text-primary">
            Opening hours
          </legend>
          <p className="mt-1 text-sm leading-6 text-primary/55">
            Set one opening period per day. Split hours are not supported yet.
          </p>
        </div>
        <button
          type="button"
          onClick={copyMonday}
          disabled={!draft.monday.status}
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-white px-3.5 py-2 text-sm font-semibold text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Copy Monday to all days
        </button>
      </div>

      {legacyText ? (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            Existing hours could not be safely converted
          </p>
          <p className="mt-1 text-sm leading-6 text-amber-800">
            Choose structured hours below. The legacy text remains unchanged:
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm font-medium text-amber-950">
            {legacyText}
          </p>
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {WEEKDAYS.map(({ key, label }) => {
          const day = draft[key];
          const statusId = `${key}-hours-status`;
          return (
            <div
              key={key}
              className="grid gap-3 rounded-xl border border-primary/10 bg-white p-3 sm:grid-cols-[120px_minmax(170px,1fr)_minmax(0,1.25fr)] sm:items-end"
            >
              <p className="text-sm font-semibold text-primary sm:pb-3">
                {label}
              </p>
              <label htmlFor={statusId} className="block text-xs font-medium text-primary/60">
                Status
                <select
                  id={statusId}
                  value={day.status}
                  required
                  onChange={(event) => {
                    const status = event.target.value as DraftStatus;
                    updateDay(
                      key,
                      status === "open"
                        ? { status }
                        : { status, opens: "", closes: "" }
                    );
                  }}
                  className="mt-1.5 w-full rounded-xl border border-primary/15 bg-white px-3 py-2.5 text-sm text-primary outline-none focus:border-primary/35 focus:ring-2 focus:ring-primary/10"
                >
                  <option value="">Choose status</option>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                  <option value="open_24_hours">Open 24 hours</option>
                </select>
              </label>

              {day.status === "open" ? (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs font-medium text-primary/60">
                    Opens
                    <input
                      type="time"
                      value={day.opens}
                      required
                      onChange={(event) =>
                        updateDay(key, { opens: event.target.value })
                      }
                      className="mt-1.5 w-full rounded-xl border border-primary/15 bg-white px-3 py-2.5 text-sm text-primary outline-none focus:border-primary/35 focus:ring-2 focus:ring-primary/10"
                    />
                  </label>
                  <label className="block text-xs font-medium text-primary/60">
                    Closes
                    <input
                      type="time"
                      value={day.closes}
                      required
                      onChange={(event) =>
                        updateDay(key, { closes: event.target.value })
                      }
                      className="mt-1.5 w-full rounded-xl border border-primary/15 bg-white px-3 py-2.5 text-sm text-primary outline-none focus:border-primary/35 focus:ring-2 focus:ring-primary/10"
                    />
                  </label>
                </div>
              ) : (
                <p className="pb-2 text-sm text-primary/45 sm:pb-3">
                  {day.status === "closed"
                    ? "Closed all day"
                    : day.status === "open_24_hours"
                      ? "Open all day"
                      : "Choose this day’s status"}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
