"use client";

import { Building2, Globe, LocateFixed, MapPin, Target, UserRound } from "lucide-react";
import type {
  EntityCoachSuggestion,
  EntityVenueSuggestion,
  OutcomeSuggestion,
  WhereSuggestionsResult,
} from "../../lib/queries/searchSuggestions";
import type { SearchMode } from "../../lib/marketplaceSearch";
import { coachDisplayImageUrl } from "../../lib/coachImage";

type MarketplaceSearchSuggestionsProps = {
  mode: SearchMode;
  field: "where" | "entity";
  where: WhereSuggestionsResult;
  venues: EntityVenueSuggestion[];
  coaches: EntityCoachSuggestion[];
  outcomes?: OutcomeSuggestion[];
  loading?: boolean;
  emptyMessage: string;
  onSelectCity: (label: string) => void;
  onSelectCountry: (label: string) => void;
  onSelectVenue: (venue: EntityVenueSuggestion) => void;
  onSelectCoach: (coach: EntityCoachSuggestion) => void;
  onSelectOutcome?: (label: string) => void;
  onSelectNearby?: () => void;
  nearbyLoading?: boolean;
  nearbySubline?: string;
};

const optionRowClass =
  "mx-1.5 flex w-[calc(100%-0.75rem)] cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-primary transition-colors duration-150 ease-out hover:bg-black/[0.06]";

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
  outcomes = [],
  loading,
  emptyMessage,
  onSelectCity,
  onSelectCountry,
  onSelectVenue,
  onSelectCoach,
  onSelectOutcome,
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
            className={`${optionRowClass} border-b border-primary/10 disabled:cursor-not-allowed disabled:opacity-60`}
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
            {where.countries.length > 0 ? (
              <div>
                <SectionTitle>Countries</SectionTitle>
                {where.countries.map((c) => (
                  <button
                    key={`country-${c.country}`}
                    type="button"
                    role="option"
                    onClick={() => onSelectCountry(c.label)}
                    className={optionRowClass}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Globe className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {where.cities.length > 0 ? (
              <div>
                <SectionTitle>Cities</SectionTitle>
                {where.cities.map((c) => (
                  <button
                    key={`city-${c.city}-${c.country}`}
                    type="button"
                    role="option"
                    onClick={() => onSelectCity(c.label)}
                    className={optionRowClass}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <MapPin className="h-4 w-4" aria-hidden />
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
            className={optionRowClass}
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

  const hasCoachResults = coaches.length > 0 || outcomes.length > 0;
  if (!hasCoachResults) {
    return <div className="px-3 py-4 text-center text-sm text-primary/60">{emptyMessage}</div>;
  }

  return (
    <>
      {outcomes.length > 0 ? (
        <div>
          <SectionTitle>Goals</SectionTitle>
          {outcomes.map((o) => (
            <button
              key={`outcome-${o.label}`}
              type="button"
              role="option"
              onClick={() => onSelectOutcome?.(o.label)}
              className={optionRowClass}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Target className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary">{o.label}</span>
            </button>
          ))}
        </div>
      ) : null}
      {coaches.length > 0 ? (
        <div>
          <SectionTitle>Coaches</SectionTitle>
          {coaches.map((c) => (
            <button
              key={c.id}
              type="button"
              role="option"
              onClick={() => onSelectCoach(c)}
              className={optionRowClass}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coachDisplayImageUrl(c.imageUrl)}
                  alt=""
                  className="h-full w-full object-cover object-[center_20%]"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.src = coachDisplayImageUrl(null);
                  }}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-primary">{c.name}</span>
                {(c.role || c.locationSummary) && (
                  <span className="mt-0.5 block truncate text-xs text-primary/60">
                    {[c.role, c.locationSummary].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
