"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Building2, MapPin, Search, UserRound, X } from "lucide-react";
import {
  entityFieldLabel,
  entityPlaceholder,
  modeCountLabel,
  searchModeLabel,
  type SearchMode,
} from "../../lib/marketplaceSearch";
import type {
  EntityCoachSuggestion,
  EntityVenueSuggestion,
  SuggestionsApiPayload,
} from "../../lib/queries/searchSuggestions";
import MarketplaceSearchSuggestions from "./MarketplaceSearchSuggestions";

export type MarketplaceSearchModalProps = {
  open: boolean;
  onClose: () => void;
  mode: SearchMode;
  venueCount: number | null;
  coachCount: number | null;
  location: string;
  entity: string;
  activeField: "where" | "entity" | null;
  setActiveField: (field: "where" | "entity" | null) => void;
  suggestions: SuggestionsApiPayload;
  loadingSuggestions: boolean;
  onChangeMode: (mode: SearchMode) => void;
  onChangeLocation: (value: string) => void;
  onChangeEntity: (value: string) => void;
  onSelectCity: (label: string) => void;
  onSelectCountry: (label: string) => void;
  onSelectVenue: (venue: EntityVenueSuggestion) => void;
  onSelectCoach: (coach: EntityCoachSuggestion) => void;
  onSelectOutcome?: (label: string) => void;
  onSelectNearby?: () => void;
  nearbyLoading?: boolean;
  onClearAll: () => void;
  onSubmit: () => void;
};

const fieldInputClass =
  "w-full bg-transparent py-3 text-base text-primary placeholder:text-primary/45 focus:outline-none sm:text-[15px]";

function FieldShell({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border bg-white px-4 transition ${
        active ? "border-primary/40 ring-2 ring-primary/10" : "border-primary/15"
      }`}
    >
      {children}
    </div>
  );
}

export default function MarketplaceSearchModal({
  open,
  onClose,
  mode,
  venueCount,
  coachCount,
  location,
  entity,
  activeField,
  setActiveField,
  suggestions,
  loadingSuggestions,
  onChangeMode,
  onChangeLocation,
  onChangeEntity,
  onSelectCity,
  onSelectCountry,
  onSelectVenue,
  onSelectCoach,
  onSelectOutcome,
  onSelectNearby,
  nearbyLoading,
  onClearAll,
  onSubmit,
}: MarketplaceSearchModalProps) {
  const [shown, setShown] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!open && shown) {
    setShown(false);
  }

  useEffect(() => {
    if (!open) return;
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const modeCard = (m: SearchMode) => {
    const selected = mode === m;
    const Icon = m === "venues" ? Building2 : UserRound;
    return (
      <button
        key={m}
        type="button"
        onClick={() => onChangeMode(m)}
        aria-pressed={selected}
        className={`flex flex-col gap-2 rounded-2xl border p-3 text-left transition-colors duration-150 ${
          selected
            ? "border-accent bg-white shadow-sm ring-2 ring-accent/30"
            : "border-transparent bg-black/[0.03] hover:bg-black/[0.06]"
        }`}
      >
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-full ${
            selected ? "bg-primary text-white" : "bg-primary/10 text-primary"
          }`}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <span>
          <span className="block text-sm font-semibold text-primary">{searchModeLabel(m)}</span>
          <span className="mt-0.5 block text-xs text-primary/60">
            {modeCountLabel(m, m === "venues" ? venueCount : coachCount)}
          </span>
        </span>
      </button>
    );
  };

  const suggestionPanel = (
    <div className="pp-pop-in mt-2 max-h-[42vh] overflow-y-auto rounded-2xl border border-primary/15 bg-white py-1 shadow-sm">
      <MarketplaceSearchSuggestions
        mode={mode}
        field={activeField === "entity" ? "entity" : "where"}
        where={suggestions.where}
        venues={suggestions.venues}
        coaches={suggestions.coaches}
        outcomes={suggestions.outcomes}
        loading={loadingSuggestions}
        emptyMessage="No matches — try another spelling"
        onSelectCity={onSelectCity}
        onSelectCountry={onSelectCountry}
        onSelectVenue={onSelectVenue}
        onSelectCoach={onSelectCoach}
        onSelectOutcome={onSelectOutcome}
        onSelectNearby={activeField === "where" ? onSelectNearby : undefined}
        nearbyLoading={nearbyLoading}
        nearbySubline={mode === "coaches" ? "Find coaches around you" : "Find venues around you"}
      />
    </div>
  );

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[70] flex flex-col bg-surface transition-transform duration-300 ease-out md:hidden ${
        shown ? "translate-y-0" : "translate-y-full"
      } ${open ? "" : "pointer-events-none"}`}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <div className="flex items-center justify-between border-b border-primary/10 bg-white px-4 py-3">
        <span className="text-base font-semibold text-primary">Find your padel</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close search"
          className="flex h-9 w-9 items-center justify-center rounded-full text-primary/70 transition hover:bg-surface"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="grid grid-cols-2 gap-2">
          {modeCard("venues")}
          {modeCard("coaches")}
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <FieldShell active={activeField === "where"}>
              <span className="mt-2 block text-[11px] font-semibold uppercase tracking-wide text-primary/50">
                Where
              </span>
              <div className="flex items-center gap-2 pb-1">
                <MapPin className="h-4 w-4 shrink-0 text-secondary" aria-hidden />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => onChangeLocation(e.target.value)}
                  onFocus={() => setActiveField("where")}
                  placeholder="City or country"
                  autoComplete="off"
                  className={fieldInputClass}
                  aria-label="Where"
                />
                {location ? (
                  <button
                    type="button"
                    onClick={() => onChangeLocation("")}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-primary/50 hover:bg-surface"
                    aria-label="Clear location"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </FieldShell>
            {activeField === "where" ? suggestionPanel : null}
          </div>

          <div>
            <FieldShell active={activeField === "entity"}>
              <span className="mt-2 block text-[11px] font-semibold uppercase tracking-wide text-primary/50">
                {entityFieldLabel(mode)}
              </span>
              <div className="flex items-center gap-2 pb-1">
                <Search className="h-4 w-4 shrink-0 text-secondary" aria-hidden />
                <input
                  type="text"
                  value={entity}
                  onChange={(e) => onChangeEntity(e.target.value)}
                  onFocus={() => setActiveField("entity")}
                  placeholder={entityPlaceholder(mode)}
                  autoComplete="off"
                  className={fieldInputClass}
                  aria-label={entityFieldLabel(mode)}
                />
                {entity ? (
                  <button
                    type="button"
                    onClick={() => onChangeEntity("")}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-primary/50 hover:bg-surface"
                    aria-label={`Clear ${entityFieldLabel(mode).toLowerCase()}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </FieldShell>
            {activeField === "entity" ? suggestionPanel : null}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-primary/10 bg-white px-4 py-3">
        <button
          type="button"
          onClick={onClearAll}
          className="rounded-xl px-3 py-2 text-sm font-semibold text-primary/70 underline-offset-4 transition hover:text-primary hover:underline"
        >
          Clear all
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-6 text-sm font-semibold text-primary transition hover:bg-accent/90"
        >
          <Search className="h-4 w-4" aria-hidden />
          Search
        </button>
      </div>
    </div>,
    document.body
  );
}
