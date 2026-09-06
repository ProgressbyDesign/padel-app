"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarClock } from "lucide-react";
import { makeCoachAvailabilityPublic } from "@/app/account/coaches/[coachId]/availability-actions";
import type { AvailabilityVenueSummary } from "@/lib/coachAvailability/types";
import {
  formatInTimeZone,
  timeZoneAbbreviation,
} from "@/lib/coachAvailability/timezone";

function visibilityState(venue: AvailabilityVenueSummary): {
  kind: "live" | "hidden" | "not_configured";
  label: string;
  detail: string | null;
} {
  if (venue.settings == null) {
    return {
      kind: "not_configured",
      label: "Availability not configured",
      detail:
        "Set up availability at this venue to start receiving booking requests.",
    };
  }
  const hasSchedule =
    venue.ruleCount > 0 ||
    venue.upcomingExceptionCount > 0 ||
    Boolean(venue.nextSlotStartsAt);
  if (venue.settings.is_public && hasSchedule) {
    return {
      kind: "live",
      label: "Availability live",
      detail: null,
    };
  }
  if (venue.settings.is_public && !hasSchedule) {
    return {
      kind: "live",
      label: "Availability live",
      detail: "Public, but no upcoming sessions yet.",
    };
  }
  return {
    kind: "hidden",
    label: "Schedule configured, but hidden from the public venue calendar.",
    detail:
      hasSchedule
        ? "Players will not see these sessions until you make availability public."
        : "Schedule settings exist but are hidden from public booking.",
  };
}

export default function CoachAvailabilityOverview({
  coachId,
  venues,
}: {
  coachId: string;
  venues: AvailabilityVenueSummary[];
}) {
  if (venues.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-primary/20 bg-white p-8 text-center sm:p-12">
        <CalendarClock className="mx-auto h-8 w-8 text-primary/35" aria-hidden />
        <h2 className="mt-5 text-xl text-primary">
          No active coaching venues yet
        </h2>
        <p className="mt-3 text-sm text-primary/60">
          Confirm a venue relationship before adding availability.
        </p>
        <Link
          href={`/account/coaches/${encodeURIComponent(coachId)}/venues`}
          className="mt-6 inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent"
        >
          Manage venues
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {venues.map((venue) => (
        <VenueAvailabilityCard
          key={venue.relationshipId}
          coachId={coachId}
          venue={venue}
        />
      ))}
    </ul>
  );
}

function VenueAvailabilityCard({
  coachId,
  venue,
}: {
  coachId: string;
  venue: AvailabilityVenueSummary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const location = [venue.city, venue.country].filter(Boolean).join(", ");
  const scheduleHref = `/account/coaches/${encodeURIComponent(coachId)}/availability/${encodeURIComponent(venue.relationshipId)}`;
  const visibility = visibilityState(venue);

  if (visibility.kind === "not_configured") {
    return (
      <li className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl text-primary">{venue.venueName}</h2>
            {location ? (
              <p className="mt-1 text-sm text-primary/55">{location}</p>
            ) : null}
            <p className="mt-3 text-sm font-semibold text-primary/80">
              {visibility.label}
            </p>
            {visibility.detail ? (
              <p className="mt-1 text-sm text-primary/60">{visibility.detail}</p>
            ) : null}
          </div>
          <Link
            href={scheduleHref}
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent"
          >
            Set up availability
          </Link>
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl text-primary">{venue.venueName}</h2>
          {location ? (
            <p className="mt-1 text-sm text-primary/55">{location}</p>
          ) : null}
          <p
            className={`mt-3 text-sm font-semibold ${
              visibility.kind === "live"
                ? "text-emerald-800"
                : "text-amber-950"
            }`}
          >
            {visibility.label}
          </p>
          {visibility.detail ? (
            <p className="mt-1 text-sm text-primary/60">{visibility.detail}</p>
          ) : null}
          {error ? (
            <p className="mt-2 text-sm text-red-800" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {visibility.kind === "hidden" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const result = await makeCoachAvailabilityPublic({
                    coachId,
                    relationshipId: venue.relationshipId,
                  });
                  if (!result.ok) {
                    setError(result.message);
                    return;
                  }
                  router.refresh();
                });
              }}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent disabled:opacity-60"
            >
              Make availability public
            </button>
          ) : null}
          <Link
            href={scheduleHref}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-primary/15 px-4 py-2 text-sm font-semibold text-primary hover:bg-surface"
          >
            Edit schedule
          </Link>
        </div>
      </div>

      {venue.settings ? (
        <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Summary
            label="Timezone"
            value={`${venue.settings.timezone} (${timeZoneAbbreviation(venue.settings.timezone)})`}
          />
          <Summary
            label="Visibility"
            value={venue.settings.is_public ? "Public" : "Hidden from public"}
          />
          <Summary
            label="Default session"
            value={`${venue.settings.default_slot_duration_minutes} min`}
          />
          <Summary
            label="Upcoming exceptions"
            value={String(venue.upcomingExceptionCount)}
          />
        </dl>
      ) : null}

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary/45">
          Weekly schedule
        </p>
        {venue.weeklySummary.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm text-primary/75">
            {venue.weeklySummary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-primary/55">No recurring hours</p>
        )}
      </div>

      {venue.nextSlotStartsAt && venue.settings ? (
        <p className="mt-4 text-sm text-primary/65">
          Next session:{" "}
          {formatInTimeZone(venue.nextSlotStartsAt, venue.settings.timezone, {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
          })}
        </p>
      ) : null}
    </li>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface/70 px-3 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-primary/45">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-primary">{value}</dd>
    </div>
  );
}
