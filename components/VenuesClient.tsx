"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import VenueCard from "./VenueCard";
import FiltersModal from "./listing/FiltersModal";
import MarketplaceSearch from "./search/MarketplaceSearch";
import type { MarketplaceSearchValues } from "../lib/marketplaceSearch";
import ListingPagination from "./listing/ListingPagination";
import { useListingNavigation, useScrollToTopOnPageChange } from "./listing/useListingNavigation";
import { addDistancesToVenues } from "../lib/distance";
import { requestUserPosition } from "../lib/requestUserPosition";
import { clearUserGeo, readUserGeo, writeUserGeo } from "../lib/userGeoSession";
import type { UserGeolocation } from "../hooks/useUserGeolocation";
import {
  buildVenueListingQuery,
  type VenueListingUrlState,
} from "../lib/listingUrlParams";
import {
  countVenueModalFiltersActive,
  defaultFilters,
  type FilterState,
  type SortBy,
  type SortDirection,
  type Venue,
} from "../lib/venueFilters";

type VenuesClientProps = {
  venues: Venue[];
  totalCount: number;
  page: number;
  totalPages: number;
  pageSize: number;
  urlState: VenueListingUrlState;
  nearLat?: number | null;
  nearLng?: number | null;
};

const sortSelectClass =
  "h-10 min-w-[10rem] cursor-pointer appearance-none rounded-xl border border-primary/15 bg-white pl-3 pr-9 text-sm font-medium text-primary shadow-sm outline-none transition duration-200 ease-out hover:border-primary/25 hover:shadow-sm focus:border-primary/40 focus:ring-2 focus:ring-primary/10";

export default function VenuesClient({
  venues,
  totalCount,
  page,
  totalPages,
  pageSize,
  urlState,
  nearLat: nearLatProp,
  nearLng: nearLngProp,
}: VenuesClientProps) {
  const router = useRouter();
  const { pushQuery } = useListingNavigation("/venues");
  useScrollToTopOnPageChange(page);

  const [userCoords, setUserCoords] = useState<UserGeolocation>(() => {
    if (nearLatProp != null && nearLngProp != null) {
      return { latitude: nearLatProp, longitude: nearLngProp };
    }
    return readUserGeo();
  });
  const [nearbyMode, setNearbyMode] = useState(
    () => urlState.sortBy === "distance" || (nearLatProp != null && nearLngProp != null)
  );
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filters = urlState.filters;
  const sortBy = urlState.sortBy;
  const sortDirection = urlState.sortDirection;

  const commitUrl = useCallback(
    (next: {
      filters?: FilterState;
      sortBy?: SortBy;
      sortDirection?: SortDirection;
      page?: number;
      lat?: number | null;
      lng?: number | null;
    }) => {
      const f = next.filters ?? filters;
      const sb = next.sortBy ?? sortBy;
      const sd = next.sortDirection ?? sortDirection;
      pushQuery(() => {
        const state = {
          page: next.page ?? 1,
          location: f.locationQuery,
          venue: f.venueQuery,
          search: [f.locationQuery, f.venueQuery].filter(Boolean).join(" ").trim(),
          sortBy: sb,
          sortDirection: sd,
          filters: f,
        };
        const q = buildVenueListingQuery(state);
        if (next.lat != null && next.lng != null) {
          q.set("lat", String(next.lat));
          q.set("lng", String(next.lng));
        }
        return q;
      }, { page: next.page ?? 1 });
    },
    [filters, sortBy, sortDirection, pushQuery]
  );

  const clearNearby = useCallback(() => {
    setUserCoords(null);
    setNearbyMode(false);
    clearUserGeo();
    commitUrl({ sortBy: "best_match", sortDirection: "desc", lat: null, lng: null });
  }, [commitUrl]);

  const handleNearbyFromSearch = useCallback(async () => {
    setNearbyLoading(true);
    const pos = await requestUserPosition();
    setNearbyLoading(false);
    if (pos) {
      setUserCoords(pos);
      writeUserGeo(pos);
      setNearbyMode(true);
      commitUrl({
        filters: { ...filters, locationQuery: "", venueQuery: "" },
        sortBy: "distance",
        sortDirection: "asc",
        lat: pos.latitude,
        lng: pos.longitude,
      });
    }
  }, [commitUrl, filters]);

  const applyMarketplaceSearch = useCallback(
    (values: MarketplaceSearchValues) => {
      if (values.mode === "coaches") {
        const q = new URLSearchParams();
        if (values.location.trim()) q.set("location", values.location.trim());
        if (values.entity.trim()) q.set("coach", values.entity.trim());
        const qs = q.toString();
        router.push(qs ? `/coaches?${qs}` : "/coaches");
        return;
      }
      setNearbyMode(false);
      clearUserGeo();
      commitUrl({
        filters: {
          ...filters,
          locationQuery: values.location.trim(),
          venueQuery: values.entity.trim(),
        },
        sortBy: "best_match",
        lat: null,
        lng: null,
      });
    },
    [commitUrl, filters, router]
  );

  const venuesWithDistance = useMemo(
    () => addDistancesToVenues(venues, userCoords),
    [venues, userCoords]
  );

  const modalFilterCount = useMemo(() => countVenueModalFiltersActive(filters), [filters]);

  const buildPageHref = useCallback(
    (p: number) => {
      const q = buildVenueListingQuery({
        ...urlState,
        page: p,
      });
      if (userCoords && sortBy === "distance") {
        q.set("lat", String(userCoords.latitude));
        q.set("lng", String(userCoords.longitude));
      }
      const qs = q.toString();
      return qs ? `/venues?${qs}` : "/venues";
    },
    [urlState, userCoords, sortBy]
  );

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

    if (nearbyMode && userCoords) {
      chips.push({ key: "nearby", label: "Nearby", onRemove: clearNearby });
    }

    if (filters.environment !== "all") {
      chips.push({
        key: `environment-${filters.environment}`,
        label: filters.environment === "indoor" ? "Indoor" : "Outdoor",
        onRemove: () => commitUrl({ filters: { ...filters, environment: "all" } }),
      });
    }

    if (filters.minCourts > 0) {
      chips.push({
        key: `courts-${filters.minCourts}`,
        label: `Courts: ${filters.minCourts}+`,
        onRemove: () => commitUrl({ filters: { ...filters, minCourts: 0 } }),
      });
    }

    return chips;
  }, [filters, nearbyMode, userCoords, clearNearby, commitUrl]);

  const clearAll = useCallback(() => {
    clearNearby();
    commitUrl({
      filters: defaultFilters,
      sortBy: "best_match",
      sortDirection: "desc",
      lat: null,
      lng: null,
    });
  }, [clearNearby, commitUrl]);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <MarketplaceSearch
          variant="listing"
          defaultMode="venues"
          initialValues={{
            mode: "venues",
            location: urlState.location,
            entity: urlState.venue,
          }}
          onSubmit={applyMarketplaceSearch}
          onSelectNearby={handleNearbyFromSearch}
          nearbyLoading={nearbyLoading}
          className="min-w-0 flex-1"
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

        {activeChips.length > 0 ? (
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
        onApply={(next) =>
          commitUrl({
            filters: { ...filters, ...next },
          })
        }
        onReset={() =>
          commitUrl({
            filters: { ...filters, environment: "all", minCourts: 0 },
          })
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
          <span className="font-semibold text-primary">{totalCount}</span> venues
          {totalPages > 1 ? (
            <span className="text-primary/55">
              {" "}
              · Page {page} of {totalPages}
            </span>
          ) : null}
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <label className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-primary/60">Sort by</span>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => {
                  const next = e.target.value as SortBy;
                  commitUrl({
                    sortBy: next,
                    sortDirection:
                      next === "distance" ? "asc" : next === "best_match" ? "desc" : sortDirection,
                    lat: next === "distance" && userCoords ? userCoords.latitude : null,
                    lng: next === "distance" && userCoords ? userCoords.longitude : null,
                  });
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
                  onChange={(e) =>
                    commitUrl({ sortDirection: e.target.value as SortDirection })
                  }
                  className={sortSelectClass}
                  aria-label="Sort order"
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

      {venues.length === 0 ? (
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
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {venuesWithDistance.map((venue) => (
              <VenueCard key={venue.id} venue={venue} />
            ))}
          </div>
          <ListingPagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={pageSize}
            buildHref={buildPageHref}
            itemLabel="venues"
          />
        </>
      )}
    </div>
  );
}
