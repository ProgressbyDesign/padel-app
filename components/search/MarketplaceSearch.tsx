"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Search, X } from "lucide-react";
import {
  buildMarketplaceSearchUrl,
  entityFieldLabel,
  entityPlaceholder,
  modeTagline,
  type MarketplaceSearchValues,
  type SearchMode,
} from "../../lib/marketplaceSearch";
import type { SuggestionsApiPayload } from "../../lib/queries/searchSuggestions";
import { requestUserPosition } from "../../lib/requestUserPosition";
import { writeUserGeo } from "../../lib/userGeoSession";
import { coachListingProfileHref } from "../../lib/coachListing";
import { useMarketplaceCounts } from "../../hooks/useMarketplaceCounts";
import MarketplaceSearchSuggestions from "./MarketplaceSearchSuggestions";
import MarketplaceSearchModal from "./MarketplaceSearchModal";
import SearchModeSelect from "./SearchModeSelect";

export type MarketplaceSearchVariant = "hero" | "listing" | "compact";

export type MarketplaceSearchProps = {
  variant?: MarketplaceSearchVariant;
  /** Default mode when not on a locked PLP */
  defaultMode?: SearchMode;
  /** Lock mode dropdown (unused — PLP still allows switching per spec) */
  initialValues?: Partial<MarketplaceSearchValues>;
  /** Called instead of internal navigation when provided (PLP sync) */
  onSubmit?: (values: MarketplaceSearchValues) => void;
  /** Lifted state for homepage hero + sticky sync */
  onValuesChange?: (values: MarketplaceSearchValues) => void;
  onSelectNearby?: () => void | Promise<void>;
  nearbyLoading?: boolean;
  className?: string;
};

const EMPTY_SUGGESTIONS: SuggestionsApiPayload = {
  where: { cities: [], countries: [] },
  venues: [],
  coaches: [],
};

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function MarketplaceSearch({
  variant = "listing",
  defaultMode = "venues",
  initialValues,
  onSubmit,
  onValuesChange,
  onSelectNearby,
  nearbyLoading: nearbyLoadingProp,
  className = "",
}: MarketplaceSearchProps) {
  const router = useRouter();
  const { venueCount, coachCount } = useMarketplaceCounts();
  const [mode, setMode] = useState<SearchMode>(initialValues?.mode ?? defaultMode);
  const [location, setLocation] = useState(initialValues?.location ?? "");
  const [entity, setEntity] = useState(initialValues?.entity ?? "");
  const [activeField, setActiveField] = useState<"where" | "entity" | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionsApiPayload>(EMPTY_SUGGESTIONS);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [nearbyLoadingLocal, setNearbyLoadingLocal] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const debouncedFieldQuery = useDebounced(
    activeField === "where" ? location : activeField === "entity" ? entity : "",
    220
  );

  const isHero = variant === "hero";
  const isCompact = variant === "compact";
  const nearbyLoading = nearbyLoadingProp ?? nearbyLoadingLocal;

  useEffect(() => {
    if (!initialValues) return;
    if (initialValues.mode) setMode(initialValues.mode);
    if (initialValues.location !== undefined) setLocation(initialValues.location);
    if (initialValues.entity !== undefined) setEntity(initialValues.entity);
  }, [initialValues]);

  const emitValues = useCallback(
    (patch: Partial<MarketplaceSearchValues>) => {
      const next: MarketplaceSearchValues = {
        mode: patch.mode ?? mode,
        location: patch.location ?? location,
        entity: patch.entity ?? entity,
      };
      onValuesChange?.(next);
      return next;
    },
    [mode, location, entity, onValuesChange]
  );

  const closeDropdown = useCallback(() => setActiveField(null), []);

  const changeMode = useCallback(
    (m: SearchMode) => {
      setMode(m);
      setEntity("");
      emitValues({ mode: m, entity: "" });
    },
    [emitValues]
  );

  const changeLocation = useCallback(
    (v: string) => {
      setLocation(v);
      emitValues({ location: v });
    },
    [emitValues]
  );

  const changeEntity = useCallback(
    (v: string) => {
      setEntity(v);
      emitValues({ entity: v });
    },
    [emitValues]
  );

  useEffect(() => {
    if (!activeField) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) closeDropdown();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [activeField, closeDropdown]);

  useEffect(() => {
    if (!activeField) {
      setSuggestions(EMPTY_SUGGESTIONS);
      return;
    }

    const ac = new AbortController();
    const params = new URLSearchParams({
      mode,
      field: activeField,
      q: debouncedFieldQuery,
    });
    if (activeField === "entity" && location.trim()) {
      params.set("location", location.trim());
    }

    setLoadingSuggestions(true);
    fetch(`/api/search/suggestions?${params}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((data: SuggestionsApiPayload) => {
        if (!ac.signal.aborted) setSuggestions(data);
      })
      .catch(() => {
        if (!ac.signal.aborted) setSuggestions(EMPTY_SUGGESTIONS);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoadingSuggestions(false);
      });

    return () => ac.abort();
  }, [activeField, mode, debouncedFieldQuery, location]);

  const submit = useCallback(
    (override?: Partial<MarketplaceSearchValues>) => {
      const values: MarketplaceSearchValues = {
        mode: override?.mode ?? mode,
        location: (override?.location ?? location).trim(),
        entity: (override?.entity ?? entity).trim(),
      };
      closeDropdown();
      if (onSubmit) {
        onSubmit(values);
        return;
      }
      router.push(buildMarketplaceSearchUrl(values));
    },
    [mode, location, entity, closeDropdown, onSubmit, router]
  );

  const handleNearby = useCallback(async () => {
    if (onSelectNearby) {
      closeDropdown();
      await onSelectNearby();
      return;
    }
    setNearbyLoadingLocal(true);
    const pos = await requestUserPosition();
    setNearbyLoadingLocal(false);
    if (pos) {
      writeUserGeo(pos);
      closeDropdown();
      router.push(mode === "coaches" ? "/coaches?sort=distance" : "/venues?sort=distance");
    }
  }, [mode, onSelectNearby, closeDropdown, router]);

  const shellClass = isHero
    ? "rounded-2xl border border-white/20 bg-white/95 p-2 shadow-xl shadow-black/25 backdrop-blur-md sm:rounded-full sm:p-1.5"
    : isCompact
      ? "rounded-xl border border-primary/15 bg-white p-1.5 shadow-md"
      : "rounded-xl border border-primary/15 bg-white p-2 shadow-sm sm:rounded-2xl sm:p-1.5";

  const fieldShell = isHero
    ? "flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-0 sm:divide-x sm:divide-primary/10"
    : "flex flex-col gap-2 lg:flex-row lg:items-stretch lg:gap-0 lg:divide-x lg:divide-primary/10";

  const inputClass = isHero
    ? "w-full bg-transparent py-3 pl-1 text-[15px] text-primary placeholder:text-primary/45 focus:outline-none"
    : isCompact
      ? "w-full bg-transparent py-2 pl-1 text-sm text-primary placeholder:text-primary/45 focus:outline-none"
      : "w-full bg-transparent py-2.5 pl-1 text-sm text-primary placeholder:text-primary/45 focus:outline-none";

  const labelClass = "text-[10px] font-semibold uppercase tracking-wide text-primary/50 sm:text-[11px]";

  const searchBtnClass = isHero
    ? "flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-6 text-sm font-semibold text-primary transition hover:bg-accent/90 sm:h-12 sm:w-auto sm:rounded-full"
    : "flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-sm font-semibold text-primary transition hover:bg-accent/90 lg:h-11 lg:w-auto lg:rounded-r-xl";

  const openModal = useCallback(() => {
    setModalOpen(true);
    setActiveField("where");
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setActiveField(null);
  }, []);

  const tagline = modeTagline(mode, mode === "venues" ? venueCount : coachCount);

  const modalButtonClass = isHero
    ? "flex h-14 w-full items-center gap-3 rounded-full bg-white px-5 text-left text-[15px] font-semibold text-primary shadow-xl shadow-black/25"
    : "flex h-12 w-full items-center gap-3 rounded-full border border-primary/15 bg-white px-5 text-left text-sm font-semibold text-primary shadow-sm";

  return (
    <>
      {/* Mobile: single search button → modal */}
      <div className={`mx-auto w-full max-w-3xl md:hidden ${className}`}>
        <button type="button" onClick={openModal} className={modalButtonClass}>
          <Search className="h-5 w-5 shrink-0 text-secondary" aria-hidden />
          <span>Start your padel search</span>
        </button>
        {isHero ? (
          <p className="mt-2.5 text-center text-sm font-medium text-white/75">{tagline}</p>
        ) : null}
      </div>

      <MarketplaceSearchModal
        open={modalOpen}
        onClose={closeModal}
        mode={mode}
        venueCount={venueCount}
        coachCount={coachCount}
        location={location}
        entity={entity}
        activeField={activeField}
        setActiveField={setActiveField}
        suggestions={suggestions}
        loadingSuggestions={loadingSuggestions}
        onChangeMode={changeMode}
        onChangeLocation={changeLocation}
        onChangeEntity={changeEntity}
        onSelectCity={(label) => {
          changeLocation(label);
          setActiveField("entity");
        }}
        onSelectCountry={(label) => {
          changeLocation(label);
          setActiveField("entity");
        }}
        onSelectVenue={(v) => {
          changeEntity(v.name);
          if (!location.trim()) {
            changeLocation([v.city, v.country].filter(Boolean).join(", "));
          }
          setActiveField(null);
        }}
        onSelectCoach={(c) => {
          changeEntity(c.name);
          setActiveField(null);
        }}
        onSelectNearby={handleNearby}
        nearbyLoading={nearbyLoading}
        onClearAll={() => {
          changeLocation("");
          changeEntity("");
          setActiveField("where");
        }}
        onSubmit={() => {
          submit();
          closeModal();
        }}
      />

      {/* Desktop: expanded search bar */}
      <form
        className={`mx-auto hidden w-full max-w-3xl md:block ${className}`}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div ref={wrapRef} className={`relative ${shellClass}`}>
        <div className={fieldShell}>
          {/* Mode */}
          <div className={`relative min-w-0 ${isHero ? "sm:shrink-0" : "lg:shrink-0"}`}>
            <SearchModeSelect
              mode={mode}
              onChange={(m) => {
                changeMode(m);
                closeDropdown();
              }}
              venueCount={venueCount}
              coachCount={coachCount}
              variant={variant}
            />
          </div>

          {/* Where */}
          <div className="relative min-w-0 flex-1 px-2 sm:px-3">
            <span className={`mb-0.5 block ${labelClass}`}>Where</span>
            <div className="relative flex items-center gap-1">
              <MapPin
                className={`h-4 w-4 shrink-0 ${isHero ? "text-primary/40" : "text-secondary"}`}
                aria-hidden
              />
              <input
                type="text"
                value={location}
                onChange={(e) => changeLocation(e.target.value)}
                onFocus={() => setActiveField("where")}
                placeholder="City or country"
                autoComplete="off"
                className={inputClass}
                aria-label="Where"
                aria-expanded={activeField === "where"}
              />
              {location ? (
                <button
                  type="button"
                  onClick={() => changeLocation("")}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-primary/50 hover:bg-surface"
                  aria-label="Clear location"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          {/* Coach / Venue */}
          <div className="relative min-w-0 flex-1 px-2 sm:px-3">
            <span className={`mb-0.5 block ${labelClass}`}>{entityFieldLabel(mode)}</span>
            <div className="relative flex items-center gap-1">
              <input
                type="text"
                value={entity}
                onChange={(e) => changeEntity(e.target.value)}
                onFocus={() => setActiveField("entity")}
                placeholder={entityPlaceholder(mode)}
                autoComplete="off"
                className={inputClass}
                aria-label={entityFieldLabel(mode)}
                aria-expanded={activeField === "entity"}
              />
              {entity ? (
                <button
                  type="button"
                  onClick={() => changeEntity("")}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-primary/50 hover:bg-surface"
                  aria-label={`Clear ${entityFieldLabel(mode).toLowerCase()}`}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="px-2 pb-1 sm:px-2 sm:pb-0">
            <button type="submit" className={searchBtnClass}>
              <Search className="h-4 w-4" aria-hidden />
              <span>Search</span>
            </button>
          </div>
        </div>

        {activeField ? (
          <div
            className={`absolute left-0 right-0 z-50 max-h-[min(20rem,55vh)] overflow-y-auto rounded-2xl border border-primary/15 bg-white py-1 shadow-lg ring-1 ring-black/5 ${
              isHero ? "top-[calc(100%+10px)]" : "top-[calc(100%+8px)]"
            }`}
            role="listbox"
          >
            <MarketplaceSearchSuggestions
              mode={mode}
              field={activeField}
              where={suggestions.where}
              venues={suggestions.venues}
              coaches={suggestions.coaches}
              loading={loadingSuggestions}
              emptyMessage="No matches — try another spelling or press Search"
              onSelectCity={(label) => {
                setLocation(label);
                closeDropdown();
              }}
              onSelectCountry={(label) => {
                setLocation(label);
                closeDropdown();
              }}
              onSelectVenue={(v) => {
                setEntity(v.name);
                closeDropdown();
                submit({ entity: v.name, location: location || [v.city, v.country].filter(Boolean).join(", ") });
              }}
              onSelectCoach={(c) => {
                setEntity(c.name);
                closeDropdown();
                if (variant === "listing" && mode === "coaches") {
                  router.push(coachListingProfileHref(c.id, "coaches"));
                } else {
                  submit({ entity: c.name, mode: "coaches" });
                }
              }}
              onSelectNearby={activeField === "where" ? handleNearby : undefined}
              nearbyLoading={nearbyLoading}
              nearbySubline={
                mode === "coaches" ? "Find coaches around you" : "Find venues around you"
              }
            />
          </div>
        ) : null}
        </div>
        {isHero ? (
          <p className="mt-3 text-center text-sm font-medium text-white/75">{tagline}</p>
        ) : null}
      </form>
    </>
  );
}
