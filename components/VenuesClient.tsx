"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import VenueCard from "./VenueCard";
import FiltersModal from "./listing/FiltersModal";
import ListingWhereSearch from "./listing/ListingWhereSearch";
import { addDistancesToVenues } from "../lib/distance";
import { toCoachSearchRows, toVenueSearchRows } from "../lib/coaches";
import type { CoachSearchRow } from "../lib/coaches";
import { requestUserPosition } from "../lib/requestUserPosition";
import { clearUserGeo, readUserGeo, writeUserGeo } from "../lib/userGeoSession";
import type { UserGeolocation } from "../hooks/useUserGeolocation";
import {
  buildWhereOptions,
  countVenueModalFiltersActive,
  defaultFilters,
  filterVenues,
  sortVenuesByUserChoice,
  type FilterState,
  type SortBy,
  type SortDirection,
  type Venue,
} from "../lib/venueFilters";

type VenuesClientProps = {
  venues: Venue[];
  coachSearchRows: CoachSearchRow[];
  initialFilters?: Partial<FilterState>;
};

const sortSelectClass =
  "h-10 min-w-[10rem] cursor-pointer appearance-none rounded-xl border border-primary/15 bg-white pl-3 pr-9 text-sm font-medium text-primary shadow-sm outline-none transition duration-200 ease-out hover:border-primary/25 hover:shadow-sm focus:border-primary/40 focus:ring-2 focus:ring-primary/10";

export default function VenuesClient({ venues, coachSearchRows, initialFilters }: VenuesClientProps) {
  const [userCoords, setUserCoords] = useState<UserGeolocation>(null);
  const [nearbyMode, setNearbyMode] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [filters, setFilters] = useState<FilterState>(() => ({
    ...defaultFilters,
    ...initialFilters,
  }));
  const [locationDraft, setLocationDraft] = useState(() => initialFilters?.locationQuery ?? "");
  const [sortBy, setSortBy] = useState<SortBy>("best_match");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const g = readUserGeo();
    if (g) {
      setUserCoords(g);
      setNearbyMode(true);
      setSortBy("distance");
      setSortDirection("asc");
    }
  }, []);

  const clearNearby = useCallback(() => {
    setUserCoords(null);
    setNearbyMode(false);
    clearUserGeo();
    setSortBy("best_match");
    setSortDirection("desc");
  }, []);

  const handleNearbyFromSearch = useCallback(async () => {
    setNearbyLoading(true);
    const pos = await requestUserPosition();
    setNearbyLoading(false);
    if (pos) {
      setUserCoords(pos);
      writeUserGeo(pos);
      setNearbyMode(true);
      setSortBy("distance");
      setSortDirection("asc");
      setFilters((prev) => ({ ...prev, locationQuery: "" }));
      setLocationDraft("");
    }
  }, []);

  const applyLocationSearch = useCallback(() => {
    const next = locationDraft.trim();
    setFilters((prev) => ({ ...prev, locationQuery: next }));
    if (next) {
      clearNearby();
    }
  }, [locationDraft, clearNearby]);

  const whereOptions = useMemo(() => buildWhereOptions(venues), [venues]);
  const venueSearchRows = useMemo(() => toVenueSearchRows(venues), [venues]);

  const venuesWithDistance = useMemo(
    () => addDistancesToVenues(venues, userCoords),
    [venues, userCoords]
  );

  const filteredVenues = useMemo(() => {
    const filtered = filterVenues(venuesWithDistance, filters);
    return sortVenuesByUserChoice(filtered, sortBy, sortDirection);
  }, [venuesWithDistance, filters, sortBy, sortDirection]);

  const modalFilterCount = useMemo(() => countVenueModalFiltersActive(filters), [filters]);

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

    if (nearbyMode && userCoords) {
      chips.push({
        key: "nearby",
        label: "Nearby",
        onRemove: clearNearby,
      });
    }

    if (filters.locationQuery.trim()) {
      chips.push({
        key: "where",
        label: filters.locationQuery.trim(),
        onRemove: () => {
          setFilters((prev) => ({ ...prev, locationQuery: "" }));
          setLocationDraft("");
        },
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

    return chips;
  }, [filters, nearbyMode, userCoords, clearNearby]);

  const hasActiveFilters = activeChips.length > 0;

  const clearAll = useCallback(() => {
    setFilters(defaultFilters);
    setLocationDraft("");
    clearNearby();
  }, [clearNearby]);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <ListingWhereSearch
          variant="venues"
          draftValue={locationDraft}
          onDraftChange={setLocationDraft}
          onSearchSubmit={applyLocationSearch}
          whereOptions={whereOptions}
          coachSearchRows={coachSearchRows}
          venueSearchRows={venueSearchRows}
          onSelectNearby={handleNearbyFromSearch}
          nearbyLoading={nearbyLoading}
        />

        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-primary/15 bg-white px-4 text-sm font-semibold text-primary shadow-sm transition hover:border-primary/25 hover:bg-surface sm:w-auto"
        >
          <SlidersHorizontal className="h-4 w-4 text-secondary" aria-hidden />
          Filters
          {modalFilterCount > 0 ? (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-white">
              {modalFilterCount}
            </span>
          ) : null}
        </button>

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearAll}
            className="h-11 shrink-0 rounded-xl px-3 text-sm font-semibold text-primary/70 underline-offset-4 transition hover:text-primary hover:underline sm:ml-auto"
          >
            Clear all
          </button>
        ) : null}
      </div>

      <FiltersModal
        type="venue"
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        environment={filters.environment}
        minCourts={filters.minCourts}
        onApply={(next) => setFilters((prev) => ({ ...prev, ...next }))}
        onReset={() =>
          setFilters((prev) => ({
            ...prev,
            environment: "all",
            minCourts: 0,
          }))
        }
      />

      {activeChips.length > 0 ? (
        <div className="mb-5 flex flex-wrap gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              aria-label={`Remove filter: ${chip.label}`}
              className="group/chip inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-3 pr-1 text-xs font-medium text-primary transition hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15"
            >
              <span className="max-w-[min(240px,75vw)] truncate">{chip.label}</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full text-primary/60 group-hover/chip:bg-white/80 group-hover/chip:text-primary">
                <X className="h-3.5 w-3.5" strokeWidth={2.25} />
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="mb-5 flex flex-col gap-4 border-b border-primary/10 pb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <p className="text-sm text-primary/70">
          Showing <span className="font-semibold text-primary">{filteredVenues.length}</span> of{" "}
          <span className="font-semibold text-primary">{venues.length}</span> venues
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <label className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-primary/60">Sort by</span>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => {
                  const next = e.target.value as SortBy;
                  setSortBy(next);
                  if (next === "best_match") setSortDirection("desc");
                  if (next === "distance") setSortDirection("asc");
                }}
                className={sortSelectClass}
                aria-label="Sort venues by"
              >
                <option value="best_match">Best match</option>
                <option value="distance">Distance</option>
                <option value="rating">Rating</option>
                <option value="courts">Courts</option>
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/45"
                aria-hidden
              />
            </div>
          </label>

          {sortBy !== "best_match" ? (
            <label className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-primary/60">Order</span>
              <div className="relative">
                <select
                  value={sortDirection}
                  onChange={(e) => setSortDirection(e.target.value as SortDirection)}
                  className={sortSelectClass}
                  aria-label={
                    sortBy === "rating" ? "Rating order" : sortBy === "distance" ? "Distance order" : "Courts order"
                  }
                >
                  {sortBy === "rating" ? (
                    <>
                      <option value="desc">Highest rated first</option>
                      <option value="asc">Lowest rated first</option>
                    </>
                  ) : sortBy === "distance" ? (
                    <>
                      <option value="asc">Nearest first</option>
                      <option value="desc">Farthest first</option>
                    </>
                  ) : (
                    <>
                      <option value="desc">Most courts first</option>
                      <option value="asc">Fewest courts first</option>
                    </>
                  )}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/45"
                  aria-hidden
                />
              </div>
            </label>
          ) : null}
        </div>
      </div>

      {filteredVenues.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-primary/25 bg-white px-6 py-12 text-center">
          <p className="text-base font-semibold text-primary">No venues match these filters</p>
          <p className="mt-1 text-sm text-primary/70">Try removing one or two filters to see more results.</p>
          <button
            type="button"
            onClick={clearAll}
            className="mt-4 rounded-full border border-primary/25 px-4 py-2 text-sm font-semibold text-primary/80 transition hover:bg-surface"
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
