"use client";

import type { ReactNode } from "react";
import { ChevronDown, Layers, MapPin, SlidersHorizontal, Sparkles, X } from "lucide-react";
import type { FilterState, MinCourtsFilter, VenueTypeFilter } from "../lib/venueFilters";

type ActiveFilterChip = {
  key: string;
  label: string;
  onRemove: () => void;
};

type FilterBarProps = {
  filters: FilterState;
  countryOptions: string[];
  cityOptions: string[];
  activeChips: ActiveFilterChip[];
  onCountryChange: (country: string) => void;
  onCityChange: (city: string) => void;
  onEnvironmentChange: (environment: FilterState["environment"]) => void;
  onMinCourtsChange: (minCourts: MinCourtsFilter) => void;
  onCoachingOnlyChange: (enabled: boolean) => void;
  onVenueTypeToggle: (venueType: VenueTypeFilter) => void;
  onReset: () => void;
};

const minCourtsOptions: MinCourtsFilter[] = [0, 4, 6, 8];
const venueTypes: VenueTypeFilter[] = ["premium_training", "casual", "resort"];

const labelMuted = "text-[11px] font-semibold uppercase tracking-wide text-slate-500";

const selectClass =
  "h-10 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white pl-3.5 pr-10 text-sm text-slate-900 shadow-sm outline-none transition duration-200 ease-out " +
  "hover:border-slate-300 hover:shadow-sm " +
  "focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 " +
  "active:scale-[0.99] " +
  "disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-500";

const tapTransition = "transition duration-200 ease-out active:scale-[0.98]";

function venueTypeLabel(value: VenueTypeFilter) {
  if (value === "premium_training") return "Premium";
  if (value === "casual") return "Casual";
  return "Resort";
}

function SelectField({
  label,
  value,
  onChange,
  disabled,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className={labelMuted}>{label}</span>
      <div className="group relative">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={selectClass}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition group-hover:text-slate-500"
        />
      </div>
    </div>
  );
}

function FilterSection({
  title,
  icon,
  description,
  children,
  emphasis = false,
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div
      className={
        emphasis
          ? "rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50 to-white p-4 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-5"
          : "rounded-2xl border border-transparent p-0 sm:px-0"
      }
    >
      <div className="mb-3 flex flex-col gap-0.5 sm:mb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex items-start gap-2.5">
          <span
            className={
              emphasis
                ? "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm"
                : "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
            }
            aria-hidden
          >
            {icon}
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            {description ? <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p> : null}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function FilterBar({
  filters,
  countryOptions,
  cityOptions,
  activeChips,
  onCountryChange,
  onCityChange,
  onEnvironmentChange,
  onMinCourtsChange,
  onCoachingOnlyChange,
  onVenueTypeToggle,
  onReset,
}: FilterBarProps) {
  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/[0.04]">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-4 sm:px-5 sm:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-slate-900">Find your venue</h2>
              <p className="text-xs text-slate-500">Adjust location, then dial in how you want to play.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onReset}
            className={`shrink-0 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm ${tapTransition} hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 focus-visible:ring-offset-2 sm:py-2`}
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6 px-4 py-5 sm:gap-7 sm:px-5 sm:py-6">
        {/* Location — secondary weight */}
        <FilterSection
          title="Location"
          description="Where you want to train."
          icon={<MapPin className="h-4 w-4" strokeWidth={2} />}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
            <SelectField label="Country" value={filters.country} onChange={onCountryChange}>
              <option value="all">All countries</option>
              {countryOptions.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="City"
              value={filters.city}
              onChange={onCityChange}
              disabled={cityOptions.length === 0}
            >
              <option value="all">All cities</option>
              {cityOptions.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </SelectField>
          </div>
        </FilterSection>

        {/* Playing conditions — primary emphasis */}
        <FilterSection
          emphasis
          title="Playing conditions"
          description="Indoor or outdoor, court count, and coaching — the fastest way to narrow venues."
          icon={<Layers className="h-4 w-4" strokeWidth={2} />}
        >
          <div className="flex flex-col gap-5 lg:grid lg:grid-cols-12 lg:items-stretch lg:gap-5">
            {/* Environment */}
            <div className="flex min-w-0 flex-col gap-2 lg:col-span-5">
              <span className={labelMuted}>Indoor / outdoor</span>
              <div
                className="grid h-12 grid-cols-3 gap-1 rounded-2xl border border-slate-200/90 bg-white p-1 shadow-inner"
                role="group"
                aria-label="Court environment"
              >
                {(["all", "indoor", "outdoor"] as const).map((value) => {
                  const selected = filters.environment === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onEnvironmentChange(value)}
                      className={`rounded-xl text-sm font-semibold ${tapTransition} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/25 focus-visible:ring-offset-2 ${
                        selected
                          ? "bg-slate-900 text-white shadow-md"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      {value === "all" ? "All" : value[0].toUpperCase() + value.slice(1)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Min courts — pill row */}
            <div className="flex min-w-0 flex-col gap-2 lg:col-span-4">
              <span className={labelMuted}>Min courts</span>
              <div className="grid grid-cols-4 gap-2" role="group" aria-label="Minimum number of courts">
                {minCourtsOptions.map((value) => {
                  const selected = filters.minCourts === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onMinCourtsChange(value)}
                      className={`flex h-12 min-w-0 items-center justify-center rounded-xl border text-sm font-semibold ${tapTransition} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 focus-visible:ring-offset-2 ${
                        selected
                          ? "border-slate-900 bg-slate-900 text-white shadow-md"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {value === 0 ? "Any" : `${value}+`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Coaching */}
            <div className="flex min-w-0 flex-col gap-2 lg:col-span-3">
              <span className={labelMuted}>Coaching</span>
              <button
                type="button"
                role="switch"
                aria-checked={filters.coachingOnly}
                onClick={() => onCoachingOnlyChange(!filters.coachingOnly)}
                className={`flex h-12 w-full items-center justify-between gap-3 rounded-2xl border px-4 text-left text-sm font-semibold shadow-sm ${tapTransition} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 focus-visible:ring-offset-2 ${
                  filters.coachingOnly
                    ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
                    : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="min-w-0">{filters.coachingOnly ? "Coaching only" : "Any venue"}</span>
                <span
                  className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${
                    filters.coachingOnly ? "bg-white/25" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ease-out ${
                      filters.coachingOnly ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </span>
              </button>
            </div>
          </div>
        </FilterSection>

        {/* Experience — lighter */}
        <FilterSection
          title="Experience"
          description="Optional — match the vibe of the club."
          icon={<Sparkles className="h-4 w-4" strokeWidth={2} />}
        >
          <div className="flex flex-wrap gap-2">
            {venueTypes.map((venueType) => {
              const active = filters.venueTypes.includes(venueType);
              return (
                <button
                  key={venueType}
                  type="button"
                  onClick={() => onVenueTypeToggle(venueType)}
                  className={`h-9 rounded-full border px-4 text-xs font-semibold ${tapTransition} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 focus-visible:ring-offset-2 ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white shadow-sm hover:bg-slate-800"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {venueTypeLabel(venueType)}
                </button>
              );
            })}
          </div>
        </FilterSection>
      </div>

      {activeChips.length > 0 ? (
        <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-4 sm:px-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Active filters</span>
            <span className="text-xs text-slate-500">{activeChips.length} applied</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.onRemove}
                aria-label={`Remove filter: ${chip.label}`}
                className="group/chip inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white py-1 pl-3 pr-1 text-xs font-medium text-slate-800 shadow-sm ring-1 ring-slate-900/[0.04] transition duration-200 ease-out hover:border-slate-300 hover:bg-slate-50 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 focus-visible:ring-offset-2 active:scale-[0.98]"
              >
                <span className="max-w-[min(220px,70vw)] truncate">{chip.label}</span>
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition group-hover/chip:bg-slate-200/80 group-hover/chip:text-slate-700"
                  aria-hidden
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
