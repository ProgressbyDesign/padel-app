"use client";

import type { ReactNode } from "react";
import { LocateFixed } from "lucide-react";
import type { WhereOption } from "../lib/venueFilters";
import type { CoachSearchRow, VenueSearchRow } from "../lib/coaches";

export type NearbySearchOption = {
  label: string;
  description: string;
  type: "nearby";
};

type GroupedSearchSuggestionsProps = {
  locations: WhereOption[];
  venues: VenueSearchRow[];
  coaches: CoachSearchRow[];
  selectedLocationLabel: string;
  onSelectLocation: (label: string) => void;
  onSelectVenue: (id: string) => void;
  onSelectCoach: (id: string) => void;
  onAnywhere: () => void;
  emptyMessage: string;
  /** User-triggered geolocation (e.g. "Nearby"); no request until click */
  onSelectNearby?: () => void | Promise<void>;
  nearbyLoading?: boolean;
};

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="sticky top-0 z-[1] border-b border-slate-100 bg-slate-50/95 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur-sm">
      {children}
    </div>
  );
}

export default function GroupedSearchSuggestions({
  locations,
  venues,
  coaches,
  selectedLocationLabel,
  onSelectLocation,
  onSelectVenue,
  onSelectCoach,
  onAnywhere,
  emptyMessage,
  onSelectNearby,
  nearbyLoading = false,
}: GroupedSearchSuggestionsProps) {
  const hasAny = coaches.length > 0 || venues.length > 0 || locations.length > 0;
  const q = selectedLocationLabel.trim();

  return (
    <>
      {onSelectNearby ? (
        <button
          type="button"
          role="option"
          disabled={nearbyLoading}
          onClick={() => void onSelectNearby()}
          className="flex w-full items-start gap-3 border-b border-slate-100 px-3 py-3 text-left transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LocateFixed className="mt-0.5 h-4 w-4 shrink-0 text-slate-700" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900">
              {nearbyLoading ? "Detecting location…" : "Nearby"}
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">
              {nearbyLoading ? "This may take a few seconds" : "Find venues around you"}
            </span>
          </span>
        </button>
      ) : null}

      <button
        type="button"
        role="option"
        aria-selected={!q}
        onClick={onAnywhere}
        className="flex w-full px-3 py-2.5 text-left text-sm text-slate-600 transition hover:bg-slate-50"
      >
        Anywhere
      </button>

      {!hasAny && q ? (
        <div className="px-3 py-4 text-center text-sm text-slate-500">{emptyMessage}</div>
      ) : (
        <>
          {coaches.length > 0 ? (
            <div>
              <SectionTitle>Coaches</SectionTitle>
              {coaches.map((c) => (
                <button
                  key={`coach-${c.id}`}
                  type="button"
                  role="option"
                  onClick={() => onSelectCoach(c.id)}
                  className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition hover:bg-slate-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{c.name}</span>
                    {c.role ? <span className="mt-0.5 block truncate text-xs text-slate-500">{c.role}</span> : null}
                  </span>
                  <span className="shrink-0 pt-0.5 text-xs text-slate-400">Coach</span>
                </button>
              ))}
            </div>
          ) : null}

          {venues.length > 0 ? (
            <div>
              <SectionTitle>Venues</SectionTitle>
              {venues.map((v) => (
                <button
                  key={`venue-${v.id}`}
                  type="button"
                  role="option"
                  onClick={() => onSelectVenue(v.id)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-900 transition hover:bg-slate-50"
                >
                  <span className="min-w-0 flex-1 truncate">{v.name}</span>
                  <span className="shrink-0 text-xs text-slate-400">Venue</span>
                </button>
              ))}
            </div>
          ) : null}

          {locations.length > 0 ? (
            <div>
              <SectionTitle>Locations</SectionTitle>
              {locations.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  aria-selected={q.toLowerCase() === opt.label.toLowerCase()}
                  onClick={() => onSelectLocation(opt.label)}
                  className="flex w-full px-3 py-2.5 text-left text-sm text-slate-900 transition hover:bg-slate-50"
                >
                  <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                  <span className="ml-2 shrink-0 text-xs text-slate-400">{opt.kind === "country" ? "Country" : "City"}</span>
                </button>
              ))}
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
