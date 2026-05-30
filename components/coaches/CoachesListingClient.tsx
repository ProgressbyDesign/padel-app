"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import CoachCard from "../CoachCard";
import FiltersModal from "../listing/FiltersModal";
import MarketplaceSearch from "../search/MarketplaceSearch";
import StickySearchBar from "../search/StickySearchBar";
import ListingPagination from "../listing/ListingPagination";
import { useListingNavigation, useScrollToTopOnPageChange } from "../listing/useListingNavigation";
import type { CoachListingItem, CoachListingSort } from "../../lib/coachListing";
import { coachListingProfileHref, countCoachModalFiltersActive } from "../../lib/coachListing";
import { addDistancesToCoaches } from "../../lib/distance";
import { buildCoachListingQuery, type CoachListingUrlState } from "../../lib/listingUrlParams";
import type { MarketplaceSearchValues } from "../../lib/marketplaceSearch";
import { requestUserPosition } from "../../lib/requestUserPosition";
import { clearUserGeo, readUserGeo, writeUserGeo } from "../../lib/userGeoSession";
import type { UserGeolocation } from "../../hooks/useUserGeolocation";

type CoachesListingClientProps = {
  coaches: CoachListingItem[];
  totalCount: number;
  page: number;
  totalPages: number;
  pageSize: number;
  urlState: CoachListingUrlState;
};

const SORT_OPTIONS: { value: CoachListingSort; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "rating", label: "Highest rated" },
  { value: "experience", label: "Most experienced" },
  { value: "distance", label: "Nearest" },
];

export default function CoachesListingClient({
  coaches,
  totalCount,
  page,
  totalPages,
  pageSize,
  urlState,
}: CoachesListingClientProps) {
  const router = useRouter();
  const { pushQuery } = useListingNavigation("/coaches");
  useScrollToTopOnPageChange(page);
  const searchRowRef = useRef<HTMLDivElement>(null);

  const [userCoords, setUserCoords] = useState<UserGeolocation>(() => readUserGeo());
  const [nearbyMode, setNearbyMode] = useState(() => urlState.sort === "distance");
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const sort = urlState.sort;
  const level = urlState.level;
  const audienceAdults = urlState.audienceAdults;
  const audienceJuniors = urlState.audienceJuniors;
  const travelOnly = urlState.travelOnly;

  const commitUrl = useCallback(
    (next: Partial<CoachListingUrlState> & { page?: number }) => {
      const state: CoachListingUrlState = {
        page: next.page ?? 1,
        location: next.location ?? urlState.location,
        coach: next.coach ?? urlState.coach,
        search: "",
        level: next.level ?? level,
        audienceAdults: next.audienceAdults ?? audienceAdults,
        audienceJuniors: next.audienceJuniors ?? audienceJuniors,
        travelOnly: next.travelOnly ?? travelOnly,
        sort: next.sort ?? sort,
      };
      state.search = [state.location, state.coach].filter(Boolean).join(" ").trim();
      pushQuery(() => buildCoachListingQuery(state), { page: state.page });
    },
    [
      pushQuery,
      urlState.location,
      urlState.coach,
      level,
      audienceAdults,
      audienceJuniors,
      travelOnly,
      sort,
    ]
  );

  const clearNearby = useCallback(() => {
    setUserCoords(null);
    setNearbyMode(false);
    clearUserGeo();
    if (sort === "distance") commitUrl({ sort: "recommended" });
  }, [sort, commitUrl]);

  const handleNearbyFromSearch = useCallback(async () => {
    setNearbyLoading(true);
    const pos = await requestUserPosition();
    setNearbyLoading(false);
    if (pos) {
      setUserCoords(pos);
      writeUserGeo(pos);
      setNearbyMode(true);
      commitUrl({ location: "", coach: "", sort: "distance" });
    }
  }, [commitUrl]);

  const applyMarketplaceSearch = useCallback(
    (values: MarketplaceSearchValues) => {
      if (values.mode === "venues") {
        const q = new URLSearchParams();
        if (values.location.trim()) q.set("location", values.location.trim());
        if (values.entity.trim()) q.set("venue", values.entity.trim());
        const qs = q.toString();
        router.push(qs ? `/venues?${qs}` : "/venues");
        return;
      }
      commitUrl({
        location: values.location.trim(),
        coach: values.entity.trim(),
        sort: nearbyMode ? "distance" : sort,
      });
    },
    [commitUrl, router, nearbyMode, sort]
  );

  const coachesWithDistance = useMemo(
    () => addDistancesToCoaches(coaches, userCoords),
    [coaches, userCoords]
  );

  const modalFilterCount = useMemo(
    () =>
      countCoachModalFiltersActive({
        level,
        audienceAdults,
        audienceJuniors,
        travelOnly,
      }),
    [level, audienceAdults, audienceJuniors, travelOnly]
  );

  const buildPageHref = useCallback(
    (p: number) => {
      const q = buildCoachListingQuery({ ...urlState, page: p });
      const qs = q.toString();
      return qs ? `/coaches?${qs}` : "/coaches";
    },
    [urlState]
  );

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

    if (nearbyMode && userCoords) {
      chips.push({ key: "nearby", label: "Nearby", onRemove: clearNearby });
    }

    if (level !== "all") {
      chips.push({
        key: "level",
        label: level,
        onRemove: () => commitUrl({ level: "all" }),
      });
    }

    if (audienceAdults) {
      chips.push({
        key: "adults",
        label: "Adults",
        onRemove: () => commitUrl({ audienceAdults: false }),
      });
    }

    if (audienceJuniors) {
      chips.push({
        key: "juniors",
        label: "Juniors",
        onRemove: () => commitUrl({ audienceJuniors: false }),
      });
    }

    if (travelOnly) {
      chips.push({
        key: "travel",
        label: "Travel available",
        onRemove: () => commitUrl({ travelOnly: false }),
      });
    }

    return chips;
  }, [
    urlState.location,
    urlState.coach,
    level,
    audienceAdults,
    audienceJuniors,
    travelOnly,
    nearbyMode,
    userCoords,
    clearNearby,
    commitUrl,
  ]);

  const clearAll = useCallback(() => {
    clearNearby();
    commitUrl({
      location: "",
      coach: "",
      level: "all",
      audienceAdults: false,
      audienceJuniors: false,
      travelOnly: false,
      sort: "recommended",
    });
  }, [clearNearby, commitUrl]);

  const searchInitialValues = {
    mode: "coaches" as const,
    location: urlState.location,
    entity: urlState.coach,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
      <header className="max-w-2xl">
        <h1>Find a Padel Coach</h1>
        <p className="mt-2 text-lg text-primary/70">Train anywhere, improve faster</p>
      </header>

      <StickySearchBar anchorRef={searchRowRef} innerClassName="mx-auto max-w-7xl">
        <MarketplaceSearch
          variant="compact"
          defaultMode="coaches"
          initialValues={searchInitialValues}
          onSubmit={applyMarketplaceSearch}
          onSelectNearby={handleNearbyFromSearch}
          nearbyLoading={nearbyLoading}
        />
      </StickySearchBar>

      <div
        ref={searchRowRef}
        className="mt-8 mb-2 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3"
      >
        <MarketplaceSearch
          variant="listing"
          defaultMode="coaches"
          initialValues={searchInitialValues}
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
        type="coach"
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={{
          level,
          audienceAdults,
          audienceJuniors,
          travelOnly,
        }}
        onApply={(next) =>
          commitUrl({
            level: next.level,
            audienceAdults: next.audienceAdults,
            audienceJuniors: next.audienceJuniors,
            travelOnly: next.travelOnly,
          })
        }
        onReset={() =>
          commitUrl({
            level: "all",
            audienceAdults: false,
            audienceJuniors: false,
            travelOnly: false,
          })
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
          <span className="font-semibold text-primary">{totalCount}</span> coach
          {totalCount === 1 ? "" : "es"}
          {totalPages > 1 ? (
            <span className="text-primary/55">
              {" "}
              · Page {page} of {totalPages}
            </span>
          ) : null}
        </p>
        <div className="relative w-full sm:w-56">
          <label htmlFor="coach-sort" className="sr-only">
            Sort coaches
          </label>
          <select
            id="coach-sort"
            value={sort}
            onChange={(e) => commitUrl({ sort: e.target.value as CoachListingSort })}
            className="w-full appearance-none rounded-xl border border-primary/15 bg-white py-2.5 pl-3 pr-10 text-sm font-medium text-primary outline-none focus:border-primary/25 focus:ring-2 focus:ring-primary/10"
          >
            {SORT_OPTIONS.map((o) => (
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

      {coaches.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-primary/15 bg-white px-6 py-12 text-center">
          <p className="text-lg font-semibold text-primary">No coaches match your filters</p>
          <p className="mt-2 text-sm text-primary/70">
            Try clearing audience or level, or search a different city.
          </p>
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
            {coachesWithDistance.map((c) => (
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
                  outcomeTags={c.outcomeTags}
                  priceFrom={c.priceFrom}
                  href={coachListingProfileHref(c.id)}
                />
              </li>
            ))}
          </ul>
          <ListingPagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={pageSize}
            buildHref={buildPageHref}
            itemLabel="coaches"
          />
        </>
      )}
    </div>
  );
}
