"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import CoachCard from "../CoachCard";
import CoachCardSkeleton from "./CoachCardSkeleton";
import FiltersModal from "../listing/FiltersModal";
import ListingWhereSearch from "../listing/ListingWhereSearch";
import type { CoachSearchRow, VenueSearchRow } from "../../lib/coaches";
import type { CoachListingFilters, CoachListingItem, CoachListingSort } from "../../lib/coachListing";
import {
  COACH_LIST_PAGE_SIZE,
  coachListingProfileHref,
  countCoachModalFiltersActive,
  filterCoachListing,
  initialLocationQueryForCitySlug,
  sortCoachListing,
  suggestCitiesForEmptyState,
} from "../../lib/coachListing";
import { addDistancesToCoaches } from "../../lib/distance";
import { requestUserPosition } from "../../lib/requestUserPosition";
import { clearUserGeo, readUserGeo, writeUserGeo } from "../../lib/userGeoSession";
import type { UserGeolocation } from "../../hooks/useUserGeolocation";
import type { WhereOption } from "../../lib/venueFilters";

type CoachesListingClientProps = {
  coaches: CoachListingItem[];
  whereOptions: WhereOption[];
  coachSearchRows: CoachSearchRow[];
  venueSearchRows: VenueSearchRow[];
  initialCitySlug?: string | null;
  loading?: boolean;
  initialSkeletonMs?: number;
};

const SORT_OPTIONS: { value: CoachListingSort; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "rating", label: "Highest rated" },
  { value: "experience", label: "Most experienced" },
  { value: "distance", label: "Nearest" },
];

function defaultFilters(): CoachListingFilters {
  return {
    locationQuery: "",
    level: "all",
    audienceAdults: false,
    audienceJuniors: false,
    travelOnly: false,
  };
}

export default function CoachesListingClient({
  coaches,
  whereOptions,
  coachSearchRows,
  venueSearchRows,
  initialCitySlug = null,
  loading = false,
  initialSkeletonMs = 0,
}: CoachesListingClientProps) {
  const [userCoords, setUserCoords] = useState<UserGeolocation>(null);
  const [nearbyMode, setNearbyMode] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [filters, setFilters] = useState<CoachListingFilters>(() => defaultFilters());
  const [locationDraft, setLocationDraft] = useState("");
  const [sort, setSort] = useState<CoachListingSort>("recommended");
  const [visibleCount, setVisibleCount] = useState(COACH_LIST_PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bootSkeleton, setBootSkeleton] = useState(initialSkeletonMs > 0);

  useEffect(() => {
    if (initialSkeletonMs <= 0) return;
    const t = window.setTimeout(() => setBootSkeleton(false), initialSkeletonMs);
    return () => window.clearTimeout(t);
  }, [initialSkeletonMs]);

  const showSkeleton = loading || bootSkeleton;

  useEffect(() => {
    const g = readUserGeo();
    if (g) {
      setUserCoords(g);
      setNearbyMode(true);
      setSort("distance");
    }
  }, []);

  useEffect(() => {
    if (!initialCitySlug?.trim()) return;
    const q = initialLocationQueryForCitySlug(coaches, initialCitySlug.trim());
    setFilters((prev) => ({ ...prev, locationQuery: q }));
    setLocationDraft(q);
  }, [initialCitySlug, coaches]);

  const clearNearby = useCallback(() => {
    setUserCoords(null);
    setNearbyMode(false);
    clearUserGeo();
    if (sort === "distance") setSort("recommended");
  }, [sort]);

  const handleNearbyFromSearch = useCallback(async () => {
    setNearbyLoading(true);
    const pos = await requestUserPosition();
    setNearbyLoading(false);
    if (pos) {
      setUserCoords(pos);
      writeUserGeo(pos);
      setNearbyMode(true);
      setSort("distance");
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

  const coachesWithDistance = useMemo(
    () => addDistancesToCoaches(coaches, userCoords),
    [coaches, userCoords]
  );

  const filteredSorted = useMemo(() => {
    const f = filterCoachListing(coachesWithDistance, filters);
    return sortCoachListing(f, sort);
  }, [coachesWithDistance, filters, sort]);

  useEffect(() => {
    setVisibleCount(COACH_LIST_PAGE_SIZE);
  }, [filters, sort]);

  const visible = useMemo(
    () => filteredSorted.slice(0, visibleCount),
    [filteredSorted, visibleCount]
  );

  const hasMore = visibleCount < filteredSorted.length;

  const modalFilterCount = useMemo(() => countCoachModalFiltersActive(filters), [filters]);

  const suggestions = useMemo(() => {
    if (filteredSorted.length > 0) return [];
    const guessCountry = coaches.find(
      (c) =>
        c.locationCity.toLowerCase() === filters.locationQuery.trim().toLowerCase() ||
        c.citySlug === filters.locationQuery.trim().toLowerCase().replace(/\s+/g, "-")
    )?.locationCountry;
    return suggestCitiesForEmptyState(coaches, {
      preferredCountry: guessCountry ?? null,
    });
  }, [filteredSorted.length, coaches, filters.locationQuery]);

  const clearAll = useCallback(() => {
    setFilters(defaultFilters());
    setLocationDraft("");
    clearNearby();
  }, [clearNearby]);

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

    if (filters.level !== "all") {
      chips.push({
        key: "level",
        label: filters.level,
        onRemove: () => setFilters((prev) => ({ ...prev, level: "all" })),
      });
    }

    if (filters.audienceAdults) {
      chips.push({
        key: "adults",
        label: "Adults",
        onRemove: () => setFilters((prev) => ({ ...prev, audienceAdults: false })),
      });
    }

    if (filters.audienceJuniors) {
      chips.push({
        key: "juniors",
        label: "Juniors",
        onRemove: () => setFilters((prev) => ({ ...prev, audienceJuniors: false })),
      });
    }

    if (filters.travelOnly) {
      chips.push({
        key: "travel",
        label: "Travel available",
        onRemove: () => setFilters((prev) => ({ ...prev, travelOnly: false })),
      });
    }

    return chips;
  }, [filters, nearbyMode, userCoords, clearNearby]);

  const hasActiveFilters = activeChips.length > 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
      <header className="max-w-2xl">
        <h1>
          Find a Padel Coach
        </h1>
        <p className="mt-2 text-lg text-primary/70">Train anywhere, improve faster</p>
      </header>

      <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <ListingWhereSearch
          variant="coaches"
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
        type="coach"
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={{
          level: filters.level,
          audienceAdults: filters.audienceAdults,
          audienceJuniors: filters.audienceJuniors,
          travelOnly: filters.travelOnly,
        }}
        onApply={(next) => setFilters((prev) => ({ ...prev, ...next }))}
        onReset={() =>
          setFilters((prev) => ({
            ...prev,
            level: "all",
            audienceAdults: false,
            audienceJuniors: false,
            travelOnly: false,
          }))
        }
      />

      {activeChips.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
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

      <div className="mt-6 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-primary/70">
          {showSkeleton ? (
            <span className="inline-block h-4 w-40 animate-pulse rounded bg-primary/15" />
          ) : (
            <>
              <span className="font-semibold text-primary">{filteredSorted.length}</span> coach
              {filteredSorted.length === 1 ? "" : "es"}
            </>
          )}
        </p>
        <div className="relative w-full sm:w-56">
          <label htmlFor="coach-sort" className="sr-only">
            Sort coaches
          </label>
          <select
            id="coach-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as CoachListingSort)}
            className="w-full appearance-none rounded-xl border border-primary/15 bg-white py-2.5 pl-3 pr-10 text-sm font-medium text-primary outline-none focus:border-primary/25 focus:ring-2 focus:ring-primary/10"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/60" aria-hidden />
        </div>
      </div>

      {showSkeleton ? (
        <ul className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i}>
              <CoachCardSkeleton />
            </li>
          ))}
        </ul>
      ) : filteredSorted.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-primary/15 bg-white px-6 py-12 text-center">
          <p className="text-lg font-semibold text-primary">No coaches match your filters</p>
          <p className="mt-2 text-sm text-primary/70">
            Try clearing audience or level, or explore coaches in nearby cities.
          </p>
          {suggestions.length > 0 ? (
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary/60">Popular locations</p>
              <ul className="mt-3 flex flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <li key={s.slug}>
                    <Link
                      href={`/coaches/${encodeURIComponent(s.slug)}`}
                      className="inline-flex items-center rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-primary ring-1 ring-primary/15 transition hover:ring-primary/25"
                    >
                      {s.label}
                      <span className="ml-1.5 text-primary/45">({s.count})</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <button
            type="button"
            onClick={clearAll}
            className="mt-8 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <>
          <ul className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map((c) => (
              <li key={c.id}>
                <CoachCard
                  name={c.name}
                  avatarImage={c.avatarImage}
                  rating={c.rating}
                  reviewCount={c.reviewCount}
                  level={c.level}
                  locationCity={c.locationCity}
                  locationCountry={c.locationCountry}
                  experienceYears={c.experienceYears}
                  audience={c.audience}
                  travelAvailable={c.travelAvailable}
                  outcomes={c.outcomes}
                  priceFrom={c.priceFrom}
                  href={coachListingProfileHref(c.id)}
                />
              </li>
            ))}
          </ul>

          {hasMore ? (
            <div className="mt-10 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount((n) => n + COACH_LIST_PAGE_SIZE)}
                className="rounded-xl border border-primary/15 bg-white px-6 py-3 text-sm font-semibold text-primary shadow-sm transition hover:border-primary/25 hover:bg-surface"
              >
                Load more
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
