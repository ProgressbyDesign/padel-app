"use client";

import { Building2, Globe, LocateFixed, MapPin, UserRound } from "lucide-react";
import type {
  EntityCoachSuggestion,
  EntityVenueSuggestion,
  WhereSuggestionsResult,
} from "../../lib/queries/searchSuggestions";
import type { SearchMode } from "../../lib/marketplaceSearch";

type MarketplaceSearchSuggestionsProps = {
  mode: SearchMode;
  field: "where" | "entity";
  where: WhereSuggestionsResult;
  venues: EntityVenueSuggestion[];
  coaches: EntityCoachSuggestion[];
  loading?: boolean;
  emptyMessage: string;
  onSelectCity: (label: string) => void;
  onSelectCountry: (label: string) => void;
  onSelectVenue: (venue: EntityVenueSuggestion) => void;
  onSelectCoach: (coach: EntityCoachSuggestion) => void;
  onSelectNearby?: () => void;
  nearbyLoading?: boolean;
  nearbySubline?: string;
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-[1] border-b border-primary/10 bg-surface/95 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-primary/60 backdrop-blur-sm">
      {children}
    </div>
  );
}

export default function MarketplaceSearchSuggestions({
  mode,
  field,
  where,
  venues,
  coaches,
  loading,
  emptyMessage,
  onSelectCity,
  onSelectCountry,
  onSelectVenue,
  onSelectCoach,
  onSelectNearby,
  nearbyLoading,
  nearbySubline = "Find venues around you",
}: MarketplaceSearchSuggestionsProps) {
  if (loading) {
    return <div className="px-3 py-4 text-center text-sm text-primary/55">Loading suggestions…</div>;
  }

  if (field === "where") {
    const hasAny = where.cities.length > 0 || where.countries.length > 0;
    return (
      <>
        {onSelectNearby ? (
          <button
            type="button"
            role="option"
            disabled={nearbyLoading}
            onClick={() => void onSelectNearby()}
            className="flex w-full items-start gap-3 border-b border-primary/10 px-3 py-3 text-left transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LocateFixed className="mt-0.5 h-4 w-4 shrink-0 text-secondary" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-primary">
                {nearbyLoading ? "Detecting location…" : "Nearby"}
              </span>
              <span className="mt-0.5 block text-xs text-primary/60">
                {nearbyLoading ? "This may take a few seconds" : nearbySubline}
              </span>
            </span>
          </button>
        ) : null}

        {!hasAny ? (
          <div className="px-3 py-4 text-center text-sm text-primary/60">{emptyMessage}</div>
        ) : (
          <>
            {where.cities.length > 0 ? (
              <div>
                <SectionTitle>Cities</SectionTitle>
                {where.cities.map((c) => (
                  <button
                    key={`city-${c.city}-${c.country}`}
                    type="button"
                    role="option"
                    onClick={() => onSelectCity(c.label)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-primary transition hover:bg-surface"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <MapPin className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {where.countries.length > 0 ? (
              <div>
                <SectionTitle>Countries</SectionTitle>
                {where.countries.map((c) => (
                  <button
                    key={`country-${c.country}`}
                    type="button"
                    role="option"
                    onClick={() => onSelectCountry(c.label)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-primary transition hover:bg-surface"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Globe className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </>
        )}
      </>
    );
  }

  if (mode === "venues") {
    if (venues.length === 0) {
      return <div className="px-3 py-4 text-center text-sm text-primary/60">{emptyMessage}</div>;
    }
    return (
      <div>
        <SectionTitle>Venues</SectionTitle>
        {venues.map((v) => (
          <button
            key={v.id}
            type="button"
            role="option"
            onClick={() => onSelectVenue(v)}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-surface"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-primary">
              {v.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <Building2 className="h-4 w-4" aria-hidden />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-primary">{v.name}</span>
              {(v.city || v.country) && (
                <span className="mt-0.5 block truncate text-xs text-primary/60">
                  {[v.city, v.country].filter(Boolean).join(", ")}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
    );
  }

  if (coaches.length === 0) {
    return <div className="px-3 py-4 text-center text-sm text-primary/60">{emptyMessage}</div>;
  }

  return (
    <div>
      <SectionTitle>Coaches</SectionTitle>
      {coaches.map((c) => (
        <button
          key={c.id}
          type="button"
          role="option"
          onClick={() => onSelectCoach(c)}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-surface"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
            {c.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <UserRound className="h-4 w-4" aria-hidden />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-primary">{c.name}</span>
            {c.role ? (
              <span className="mt-0.5 block truncate text-xs text-primary/60">{c.role}</span>
            ) : null}
          </span>
        </button>
      ))}
    </div>
  );
}
