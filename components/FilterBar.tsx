"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPin, SlidersHorizontal, X } from "lucide-react";
import type { FilterState, MinCourtsFilter, VenueTypeFilter, WhereOption } from "../lib/venueFilters";

type ActiveFilterChip = {
  key: string;
  label: string;
  onRemove: () => void;
};

type FilterBarProps = {
  filters: FilterState;
  whereOptions: WhereOption[];
  activeChips: ActiveFilterChip[];
  onLocationQueryChange: (value: string) => void;
  onEnvironmentChange: (environment: FilterState["environment"]) => void;
  onMinCourtsChange: (minCourts: MinCourtsFilter) => void;
  onCoachingOnlyChange: (enabled: boolean) => void;
  onVenueTypeToggle: (venueType: VenueTypeFilter) => void;
  onReset: () => void;
};

const minCourtsOptions: MinCourtsFilter[] = [0, 4, 6, 8];
const venueTypes: VenueTypeFilter[] = ["premium_training", "casual", "resort"];

function venueTypeLabel(value: VenueTypeFilter) {
  if (value === "premium_training") return "Premium";
  if (value === "casual") return "Casual";
  return "Resort";
}

/** Badge count for Filters modal only (not coaching — shown on bar). */
function modalFilterCount(filters: FilterState): number {
  let n = 0;
  if (filters.environment !== "all") n += 1;
  if (filters.minCourts > 0) n += 1;
  n += filters.venueTypes.length;
  return n;
}

export default function FilterBar({
  filters,
  whereOptions,
  activeChips,
  onLocationQueryChange,
  onEnvironmentChange,
  onMinCourtsChange,
  onCoachingOnlyChange,
  onVenueTypeToggle,
  onReset,
}: FilterBarProps) {
  const [whereOpen, setWhereOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const whereWrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const modalCount = modalFilterCount(filters);
  const q = filters.locationQuery.trim().toLowerCase();

  const filteredSuggestions = useMemo(() => {
    if (!q) return whereOptions;
    return whereOptions.filter((o) => o.label.toLowerCase().includes(q));
  }, [whereOptions, q]);

  const closeWhere = useCallback(() => setWhereOpen(false), []);

  useEffect(() => {
    if (!whereOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (whereWrapRef.current && !whereWrapRef.current.contains(e.target as Node)) closeWhere();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [whereOpen, closeWhere]);

  useEffect(() => {
    if (!modalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [modalOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeWhere();
        setModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeWhere]);

  const isOptionSelected = useCallback(
    (opt: WhereOption) => filters.locationQuery.trim().toLowerCase() === opt.label.toLowerCase(),
    [filters.locationQuery]
  );

  return (
    <div className="mb-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-2">
        {/* Where — single input */}
        <div ref={whereWrapRef} className="relative min-w-0 flex-1 lg:min-w-[240px] lg:max-w-xl">
          <MapPin className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            inputMode="search"
            value={filters.locationQuery}
            onChange={(e) => onLocationQueryChange(e.target.value)}
            onFocus={() => setWhereOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                closeWhere();
                inputRef.current?.blur();
              }
            }}
            placeholder="Where do you want to play?"
            autoComplete="off"
            aria-autocomplete="list"
            className={`h-11 w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 ${
              filters.locationQuery ? "pr-12" : "pr-4"
            }`}
          />
          {filters.locationQuery ? (
            <button
              type="button"
              onClick={() => {
                onLocationQueryChange("");
                inputRef.current?.focus();
              }}
              className="absolute right-2.5 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Clear location"
            >
              <X className="h-4 w-4" strokeWidth={2.25} />
            </button>
          ) : null}

          {whereOpen ? (
            <div
              className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5"
              role="listbox"
              aria-label="Location suggestions"
            >
              <button
                type="button"
                role="option"
                aria-selected={!filters.locationQuery.trim()}
                onClick={() => {
                  onLocationQueryChange("");
                  closeWhere();
                }}
                className="flex w-full px-3 py-2.5 text-left text-sm text-slate-600 transition hover:bg-slate-50"
              >
                Anywhere
              </button>
              {filteredSuggestions.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-slate-500">No suggestions — press Enter to search</div>
              ) : (
                filteredSuggestions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="option"
                    aria-selected={isOptionSelected(opt)}
                    onClick={() => {
                      onLocationQueryChange(opt.label);
                      closeWhere();
                    }}
                    className="flex w-full px-3 py-2.5 text-left text-sm text-slate-900 transition hover:bg-slate-50"
                  >
                    <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                    <span className="ml-2 shrink-0 text-xs text-slate-400">{opt.kind === "country" ? "Country" : "City"}</span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>

        {/* Coaching — top bar */}
        <div className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 shadow-sm">
          <span className="text-sm font-medium text-slate-700">Coaching</span>
          <button
            type="button"
            role="switch"
            aria-checked={filters.coachingOnly}
            onClick={() => onCoachingOnlyChange(!filters.coachingOnly)}
            className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
              filters.coachingOnly ? "bg-slate-900" : "bg-slate-200"
            }`}
          >
            <span
              className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                filters.coachingOnly ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Filters modal */}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15"
        >
          <SlidersHorizontal className="h-4 w-4 text-slate-500" aria-hidden />
          Filters
          {modalCount > 0 ? (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1.5 text-[11px] font-bold text-white">
              {modalCount}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={onReset}
          className="h-11 shrink-0 rounded-full px-3 text-sm font-semibold text-slate-600 underline-offset-4 transition hover:text-slate-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15"
        >
          Clear all
        </button>
      </div>

      {activeChips.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              aria-label={`Remove filter: ${chip.label}`}
              className="group/chip inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-xs font-medium text-slate-800 transition hover:bg-slate-200/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15"
            >
              <span className="max-w-[min(240px,75vw)] truncate">{chip.label}</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 group-hover/chip:bg-white/80 group-hover/chip:text-slate-800">
                <X className="h-3.5 w-3.5" strokeWidth={2.25} />
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {modalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="filters-modal-title"
        >
          <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={() => setModalOpen(false)} aria-label="Close filters" />
          <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
              <h2 id="filters-modal-title" className="text-lg font-semibold text-slate-900">
                Filters
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-8 px-5 py-6">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Playing conditions</p>
                <p className="mb-3 text-sm font-medium text-slate-900">Indoor / outdoor</p>
                <div
                  className="flex h-11 rounded-full border border-slate-200 bg-slate-50 p-1"
                  role="group"
                  aria-label="Court environment"
                >
                  {(["all", "indoor", "outdoor"] as const).map((value) => {
                    const selected = filters.environment === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => onEnvironmentChange(value)}
                        className={`flex-1 rounded-full text-xs font-semibold transition sm:text-sm ${
                          selected ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {value === "all" ? "Any" : value[0].toUpperCase() + value.slice(1)}
                      </button>
                    );
                  })}
                </div>
                <p className="mb-3 mt-6 text-sm font-medium text-slate-900">Min courts</p>
                <div className="grid grid-cols-4 gap-2">
                  {minCourtsOptions.map((value) => {
                    const selected = filters.minCourts === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => onMinCourtsChange(value)}
                        className={`h-10 rounded-xl text-sm font-semibold transition ${
                          selected ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        {value === 0 ? "Any" : `${value}+`}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Experience</p>
                <p className="mb-3 text-sm font-medium text-slate-900">Venue type</p>
                <div className="flex flex-wrap gap-2">
                  {venueTypes.map((venueType) => {
                    const active = filters.venueTypes.includes(venueType);
                    return (
                      <button
                        key={venueType}
                        type="button"
                        onClick={() => onVenueTypeToggle(venueType)}
                        className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
                          active
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        {venueTypeLabel(venueType)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 border-t border-slate-100 bg-white px-5 py-4 sm:static sm:rounded-b-3xl">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="h-12 w-full rounded-full bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Show results
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
