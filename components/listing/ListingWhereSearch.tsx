"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Search, X } from "lucide-react";
import type { CoachSearchRow, VenueSearchRow } from "../../lib/coaches";
import { capList, filterCoachRows, filterVenueRows } from "../../lib/coaches";
import type { WhereOption } from "../../lib/venueFilters";
import GroupedSearchSuggestions from "../GroupedSearchSuggestions";

type ListingWhereSearchProps = {
  variant: "venues" | "coaches";
  /** Text in the input; typing only affects suggestions until Search or a navigation action */
  draftValue: string;
  onDraftChange: (value: string) => void;
  /** Called when the user clicks Search — parent should copy draft into applied location filter */
  onSearchSubmit: () => void;
  whereOptions: WhereOption[];
  coachSearchRows: CoachSearchRow[];
  venueSearchRows: VenueSearchRow[];
  onSelectNearby: () => void | Promise<void>;
  nearbyLoading?: boolean;
  /** Submit button label (default: "Search") */
  submitLabel?: string;
};

export default function ListingWhereSearch({
  variant,
  draftValue,
  onDraftChange,
  onSearchSubmit,
  whereOptions,
  coachSearchRows,
  venueSearchRows,
  onSelectNearby,
  nearbyLoading = false,
  submitLabel = "Search",
}: ListingWhereSearchProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = draftValue.trim().toLowerCase();

  const filteredLocations = useMemo(() => {
    const base = q ? whereOptions.filter((o) => o.label.toLowerCase().includes(q)) : whereOptions;
    return capList(base, q ? 100 : 50);
  }, [whereOptions, q]);

  const filteredCoaches = useMemo(() => capList(filterCoachRows(coachSearchRows, q), q ? 50 : 8), [coachSearchRows, q]);

  const filteredVenues = useMemo(
    () => capList(filterVenueRows(venueSearchRows, q), q ? 50 : 8),
    [venueSearchRows, q]
  );

  const closeDropdown = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) closeDropdown();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, closeDropdown]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDropdown();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeDropdown]);

  const nearbySubline = variant === "coaches" ? "Find coaches around you" : "Find venues around you";

  return (
    <form
      className="min-w-0 flex-1"
      onSubmit={(e) => {
        e.preventDefault();
        closeDropdown();
        onSearchSubmit();
      }}
    >
      <div ref={wrapRef} className="relative">
        <div className="flex items-center gap-2 overflow-hidden rounded-xl border border-primary/15 bg-white py-1 pl-1 pr-1 shadow-sm transition hover:border-primary/25">
          <MapPin className="ml-2 h-4 w-4 shrink-0 text-secondary" aria-hidden />
          <div className="relative min-w-0 flex-1">
            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              value={draftValue}
              onChange={(e) => {
                onDraftChange(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder="Search by city or country"
              autoComplete="off"
              aria-autocomplete="list"
              aria-label="Search by city or country"
              className={`w-full bg-transparent py-2.5 pl-1 text-sm text-primary placeholder:text-primary/45 focus:outline-none ${
                draftValue ? "pr-10" : "pr-2"
              }`}
            />
            {draftValue ? (
              <button
                type="button"
                onClick={() => {
                  onDraftChange("");
                  inputRef.current?.focus();
                }}
                className="absolute right-1 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-primary/45 transition hover:bg-surface hover:text-primary"
                aria-label="Clear"
              >
                <X className="h-4 w-4" strokeWidth={2.25} />
              </button>
            ) : null}
          </div>
          <button
            type="submit"
            className="flex h-10 max-w-[42%] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-accent px-2.5 text-sm font-semibold text-primary transition hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 sm:max-w-none sm:px-4"
          >
            <Search className="h-4 w-4 shrink-0 sm:hidden" aria-hidden />
            <span className="truncate text-xs sm:text-sm">{submitLabel}</span>
          </button>
        </div>

        {open ? (
          <div
            className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-96 overflow-y-auto rounded-2xl border border-primary/15 bg-white py-1 shadow-lg ring-1 ring-black/5"
            role="listbox"
            aria-label="Search suggestions"
          >
            <GroupedSearchSuggestions
              locations={filteredLocations}
              venues={filteredVenues}
              coaches={filteredCoaches}
              selectedLocationLabel={draftValue}
              onSelectNearby={() => void onSelectNearby()}
              nearbyLoading={nearbyLoading}
              nearbySubline={nearbySubline}
              onAnywhere={() => {
                onDraftChange("");
                closeDropdown();
              }}
              onSelectLocation={(label) => {
                onDraftChange(label);
                closeDropdown();
              }}
              onSelectVenue={(id) => {
                closeDropdown();
                router.push(`/venue/${encodeURIComponent(id)}`);
              }}
              onSelectCoach={(id) => {
                closeDropdown();
                router.push(`/coach/${encodeURIComponent(id)}`);
              }}
              emptyMessage={q ? "No matches — press Search to explore" : "No suggestions yet — press Search to explore"}
            />
          </div>
        ) : null}
      </div>
    </form>
  );
}
