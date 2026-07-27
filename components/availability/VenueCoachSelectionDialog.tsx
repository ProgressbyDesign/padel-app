"use client";

import { useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import CoachImage from "@/components/CoachImage";
import {
  formatSessionOptionPrice,
  type VenueSessionOption,
  type VenueTimeGroup,
} from "@/lib/coachAvailability/venueTimeGroups";
import { formatInTimeZone } from "@/lib/coachAvailability/timezone";

function visibilityLabel(option: VenueSessionOption): string | null {
  if (option.visibility === "reserved") return "Reserved";
  if (option.visibility === "hidden") return "Hidden from public";
  if (option.visibility === "public") return "Public";
  return null;
}

function bookHref(option: VenueSessionOption) {
  const params = new URLSearchParams({
    relationship: option.relationshipId,
    start: option.startsAt,
  });
  return `/book/coach/${encodeURIComponent(option.coachId)}?${params.toString()}`;
}

export default function VenueCoachSelectionDialog({
  open,
  group,
  timezone,
  mode,
  onClose,
}: {
  open: boolean;
  group: VenueTimeGroup | null;
  timezone: string;
  mode: "public" | "venue_preview";
  onClose: () => void;
}) {
  const router = useRouter();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
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

  if (!open || !group) return null;

  const timeLabel = formatInTimeZone(group.startsAt, timezone, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const dateLabel = formatInTimeZone(group.startsAt, timezone, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-dark/45"
        aria-label="Close coach selection"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-primary/10 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-primary">
              Choose a coach for {timeLabel}
            </h2>
            <p className="mt-1 text-sm text-primary/60">
              {dateLabel} · {timeLabel}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-primary/15 text-primary hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {group.options.map((option) => {
            const price = formatSessionOptionPrice(option);
            const visibility = visibilityLabel(option);
            const canBook =
              mode === "public" && option.visibility !== "reserved";
            return (
              <li
                key={`${option.relationshipId}|${option.startsAt}|${option.endsAt}`}
                className="rounded-2xl border border-primary/10 bg-surface/40 p-3"
              >
                <div className="flex gap-3">
                  <CoachImage
                    src={option.coachImageUrl}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-xl object-cover object-[center_20%]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-primary">{option.coachName}</p>
                    {option.coachRole ? (
                      <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-primary/55">
                        {option.coachRole}
                      </p>
                    ) : null}
                    <p className="mt-1 text-sm text-primary/70">
                      {option.durationMinutes > 0
                        ? `${option.durationMinutes} minutes`
                        : formatInTimeZone(option.startsAt, option.timezone, {
                            hour: "2-digit",
                            minute: "2-digit",
                            hourCycle: "h23",
                          }) +
                          "–" +
                          formatInTimeZone(option.endsAt, option.timezone, {
                            hour: "2-digit",
                            minute: "2-digit",
                            hourCycle: "h23",
                          })}
                      {" · "}
                      {price}
                    </p>
                    {visibility && mode === "venue_preview" ? (
                      <p className="mt-1 text-xs font-semibold text-primary/60">
                        {visibility}
                      </p>
                    ) : null}
                  </div>
                </div>
                {canBook ? (
                  <button
                    type="button"
                    onClick={() => {
                      router.push(bookHref(option));
                    }}
                    className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Choose coach
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
