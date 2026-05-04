"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plane, X } from "lucide-react";
import type { CoachListingFilters } from "../../lib/coachListing";
import type { CourtEnvironmentFilter, MinCourtsFilter } from "../../lib/venueFilters";

const LEVEL_OPTIONS: { value: CoachListingFilters["level"]; label: string }[] = [
  { value: "all", label: "All levels" },
  { value: "Beginner", label: "Beginner" },
  { value: "Intermediate", label: "Intermediate" },
  { value: "Advanced", label: "Advanced" },
  { value: "Pro", label: "Pro" },
];

const MIN_COURTS_OPTIONS: MinCourtsFilter[] = [0, 4, 6, 8];

export type FiltersModalProps =
  | {
      type: "coach";
      open: boolean;
      onClose: () => void;
      filters: Pick<CoachListingFilters, "level" | "audienceAdults" | "audienceJuniors" | "travelOnly">;
      onApply: (next: Pick<CoachListingFilters, "level" | "audienceAdults" | "audienceJuniors" | "travelOnly">) => void;
      onReset: () => void;
    }
  | {
      type: "venue";
      open: boolean;
      onClose: () => void;
      environment: CourtEnvironmentFilter;
      minCourts: MinCourtsFilter;
      onApply: (next: { environment: CourtEnvironmentFilter; minCourts: MinCourtsFilter }) => void;
      onReset: () => void;
    };

function coachDefaults(): Pick<
  CoachListingFilters,
  "level" | "audienceAdults" | "audienceJuniors" | "travelOnly"
> {
  return {
    level: "all",
    audienceAdults: false,
    audienceJuniors: false,
    travelOnly: false,
  };
}

function venueDefaults(): { environment: CourtEnvironmentFilter; minCourts: MinCourtsFilter } {
  return { environment: "all", minCourts: 0 };
}

export default function FiltersModal(props: FiltersModalProps) {
  const { open, onClose, type } = props;

  const [coachDraft, setCoachDraft] = useState(coachDefaults);
  const [venueDraft, setVenueDraft] = useState(venueDefaults);
  const prevOpen = useRef(false);

  useEffect(() => {
    if (open && !prevOpen.current) {
      if (props.type === "coach") {
        setCoachDraft({
          level: props.filters.level,
          audienceAdults: props.filters.audienceAdults,
          audienceJuniors: props.filters.audienceJuniors,
          travelOnly: props.filters.travelOnly,
        });
      } else {
        setVenueDraft({
          environment: props.environment,
          minCourts: props.minCourts,
        });
      }
    }
    prevOpen.current = open;
  }, [open, props]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const title = type === "coach" ? "Coach filters" : "Venue filters";

  return (
    <div
      className="fixed inset-0 z-[100] flex max-h-[100dvh] items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="filters-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-dark/45 backdrop-blur-[2px] transition-opacity duration-200 motion-reduce:transition-none"
        onClick={onClose}
        aria-label="Close filters"
      />
      <div
        className="relative flex max-h-[min(92dvh,900px)] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-2xl transition-transform duration-300 ease-out will-change-transform max-sm:translate-y-0 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-primary/10 px-5 py-4">
          <h2 id="filters-modal-title" className="text-lg font-semibold text-primary">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-primary/60 transition hover:bg-surface hover:text-primary"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
          {type === "coach" ? (
            <div className="space-y-8">
              <div>
                <label
                  htmlFor="modal-coach-level"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-primary/60"
                >
                  Level
                </label>
                <div className="relative">
                  <select
                    id="modal-coach-level"
                    value={coachDraft.level}
                    onChange={(e) =>
                      setCoachDraft((d) => ({
                        ...d,
                        level: e.target.value as CoachListingFilters["level"],
                      }))
                    }
                    className="w-full appearance-none rounded-xl border border-primary/15 bg-white py-2.5 pl-3 pr-10 text-sm font-medium text-primary outline-none focus:border-primary/25 focus:ring-2 focus:ring-primary/10"
                  >
                    {LEVEL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/60"
                    aria-hidden
                  />
                </div>
              </div>

              <fieldset>
                <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-primary/60">
                  Audience
                </legend>
                <div className="flex flex-wrap gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-primary">
                    <input
                      type="checkbox"
                      checked={coachDraft.audienceAdults}
                      onChange={(e) =>
                        setCoachDraft((d) => ({ ...d, audienceAdults: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-primary/25 text-primary focus:ring-primary/20"
                    />
                    Adults
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-primary">
                    <input
                      type="checkbox"
                      checked={coachDraft.audienceJuniors}
                      onChange={(e) =>
                        setCoachDraft((d) => ({ ...d, audienceJuniors: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-primary/25 text-primary focus:ring-primary/20"
                    />
                    Juniors
                  </label>
                </div>
                <p className="mt-1.5 text-xs text-primary/60">Leave both off to include all coaches.</p>
              </fieldset>

              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-primary/15 bg-surface/80 px-3 py-2.5">
                <span className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Plane className="h-4 w-4 text-secondary" aria-hidden />
                  Travel available
                </span>
                <input
                  type="checkbox"
                  checked={coachDraft.travelOnly}
                  onChange={(e) => setCoachDraft((d) => ({ ...d, travelOnly: e.target.checked }))}
                  className="h-4 w-4 rounded border-primary/25 text-primary focus:ring-primary/20"
                />
              </label>
            </div>
          ) : (
            <div className="space-y-8">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary/60">Playing conditions</p>
                <p className="mb-3 text-sm font-medium text-primary">Indoor / outdoor</p>
                <div
                  className="flex h-11 rounded-full border border-primary/15 bg-surface p-1"
                  role="group"
                  aria-label="Court environment"
                >
                  {(["all", "indoor", "outdoor"] as const).map((value) => {
                    const selected = venueDraft.environment === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setVenueDraft((d) => ({ ...d, environment: value }))}
                        className={`flex-1 rounded-full text-xs font-semibold transition sm:text-sm ${
                          selected ? "bg-white text-primary shadow-sm" : "text-primary/70 hover:text-primary"
                        }`}
                      >
                        {value === "all" ? "Any" : value[0].toUpperCase() + value.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-medium text-primary">Minimum courts</p>
                <div className="grid grid-cols-4 gap-2">
                  {MIN_COURTS_OPTIONS.map((value) => {
                    const selected = venueDraft.minCourts === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setVenueDraft((d) => ({ ...d, minCourts: value }))}
                        className={`h-10 rounded-xl text-sm font-semibold transition ${
                          selected
                            ? "bg-primary text-white"
                            : "border border-primary/15 bg-white text-primary/80 hover:border-primary/25"
                        }`}
                      >
                        {value === 0 ? "Any" : `${value}+`}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 space-y-2 border-t border-primary/10 bg-white px-5 py-4 sm:rounded-b-3xl">
          <button
            type="button"
            onClick={() => {
              if (type === "coach") {
                props.onApply(coachDraft);
              } else {
                props.onApply(venueDraft);
              }
              onClose();
            }}
            className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-white transition hover:bg-primary/90"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={() => {
              if (type === "coach") {
                setCoachDraft(coachDefaults());
                props.onReset();
              } else {
                setVenueDraft(venueDefaults());
                props.onReset();
              }
              onClose();
            }}
            className="h-11 w-full rounded-xl border border-primary/15 text-sm font-semibold text-primary/80 transition hover:bg-surface"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
