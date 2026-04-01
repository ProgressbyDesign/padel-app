"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import FilterBar from "./FilterBar";
import VenueCard from "./VenueCard";
import {
  defaultFilters,
  filterVenues,
  getCityOptions,
  getCountryOptions,
  sortVenuesByUserChoice,
  type FilterState,
  type MinCourtsFilter,
  type SortBy,
  type SortDirection,
  type Venue,
  type VenueTypeFilter,
} from "../lib/venueFilters";

type VenuesClientProps = {
  venues: Venue[];
};

const sortSelectClass =
  "h-10 min-w-[10rem] cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-sm font-medium text-slate-900 shadow-sm outline-none transition duration-200 ease-out hover:border-slate-300 hover:shadow-sm focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10";

export default function VenuesClient({ venues }: VenuesClientProps) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [sortBy, setSortBy] = useState<SortBy>("best_match");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const countryOptions = useMemo(() => getCountryOptions(venues), [venues]);
  const cityOptions = useMemo(() => getCityOptions(venues, filters.country), [venues, filters.country]);

  const filteredVenues = useMemo(() => {
    const filtered = filterVenues(venues, filters);
    return sortVenuesByUserChoice(filtered, sortBy, sortDirection);
  }, [venues, filters, sortBy, sortDirection]);

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

    if (filters.country !== "all") {
      chips.push({
        key: `country-${filters.country}`,
        label: `Country: ${filters.country}`,
        onRemove: () => setFilters((prev) => ({ ...prev, country: "all", city: "all" })),
      });
    }

    if (filters.city !== "all") {
      chips.push({
        key: `city-${filters.city}`,
        label: `City: ${filters.city}`,
        onRemove: () => setFilters((prev) => ({ ...prev, city: "all" })),
      });
    }

    if (filters.environment !== "all") {
      chips.push({
        key: `environment-${filters.environment}`,
        label: filters.environment === "indoor" ? "Indoor" : "Outdoor",
        onRemove: () => setFilters((prev) => ({ ...prev, environment: "all" })),
      });
    }

    if (filters.minCourts > 0) {
      chips.push({
        key: `courts-${filters.minCourts}`,
        label: `Courts: ${filters.minCourts}+`,
        onRemove: () => setFilters((prev) => ({ ...prev, minCourts: 0 })),
      });
    }

    if (filters.coachingOnly) {
      chips.push({
        key: "coaching-only",
        label: "Coaching only",
        onRemove: () => setFilters((prev) => ({ ...prev, coachingOnly: false })),
      });
    }

    filters.venueTypes.forEach((venueType) => {
      const label = venueType === "premium_training" ? "Premium" : venueType[0].toUpperCase() + venueType.slice(1);
      chips.push({
        key: `venue-type-${venueType}`,
        label: `Type: ${label}`,
        onRemove: () =>
          setFilters((prev) => ({
            ...prev,
            venueTypes: prev.venueTypes.filter((value) => value !== venueType),
          })),
      });
    });

    return chips;
  }, [filters]);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8">
      <FilterBar
        filters={filters}
        countryOptions={countryOptions}
        cityOptions={cityOptions}
        activeChips={activeChips}
        onCountryChange={(country) =>
          setFilters((prev) => ({
            ...prev,
            country,
            city: "all",
          }))
        }
        onCityChange={(city) => setFilters((prev) => ({ ...prev, city }))}
        onEnvironmentChange={(environment) => setFilters((prev) => ({ ...prev, environment }))}
        onMinCourtsChange={(minCourts: MinCourtsFilter) => setFilters((prev) => ({ ...prev, minCourts }))}
        onCoachingOnlyChange={(coachingOnly) => setFilters((prev) => ({ ...prev, coachingOnly }))}
        onVenueTypeToggle={(venueType: VenueTypeFilter) =>
          setFilters((prev) => ({
            ...prev,
            venueTypes: prev.venueTypes.includes(venueType)
              ? prev.venueTypes.filter((value) => value !== venueType)
              : [...prev.venueTypes, venueType],
          }))
        }
        onReset={() => setFilters(defaultFilters)}
      />

      <div className="mb-5 flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <p className="text-sm text-slate-600">
          Showing <span className="font-semibold text-slate-900">{filteredVenues.length}</span> of{" "}
          <span className="font-semibold text-slate-900">{venues.length}</span> venues
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <label className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sort by</span>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => {
                  const next = e.target.value as SortBy;
                  setSortBy(next);
                  if (next === "best_match") setSortDirection("desc");
                }}
                className={sortSelectClass}
                aria-label="Sort venues by"
              >
                <option value="best_match">Best match</option>
                <option value="rating">Rating</option>
                <option value="courts">Courts</option>
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
            </div>
          </label>

          {sortBy !== "best_match" ? (
            <label className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Order</span>
              <div className="relative">
                <select
                  value={sortDirection}
                  onChange={(e) => setSortDirection(e.target.value as SortDirection)}
                  className={sortSelectClass}
                  aria-label={sortBy === "rating" ? "Rating order" : "Courts order"}
                >
                  {sortBy === "rating" ? (
                    <>
                      <option value="desc">Highest rated first</option>
                      <option value="asc">Lowest rated first</option>
                    </>
                  ) : (
                    <>
                      <option value="desc">Most courts first</option>
                      <option value="asc">Fewest courts first</option>
                    </>
                  )}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
              </div>
            </label>
          ) : null}
        </div>
      </div>

      {filteredVenues.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
          <p className="text-base font-semibold text-slate-900">No venues match these filters</p>
          <p className="mt-1 text-sm text-slate-600">Try removing one or two filters to see more results.</p>
          <button
            type="button"
            onClick={() => setFilters(defaultFilters)}
            className="mt-4 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {filteredVenues.map((venue) => (
            <VenueCard key={venue.id} venue={venue} />
          ))}
        </div>
      )}
    </div>
  );
}
