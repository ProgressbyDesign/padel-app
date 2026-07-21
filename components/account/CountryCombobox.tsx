"use client";

import AE from "country-flag-icons/react/3x2/AE";
import BE from "country-flag-icons/react/3x2/BE";
import DE from "country-flag-icons/react/3x2/DE";
import ES from "country-flag-icons/react/3x2/ES";
import FR from "country-flag-icons/react/3x2/FR";
import GB from "country-flag-icons/react/3x2/GB";
import IT from "country-flag-icons/react/3x2/IT";
import NL from "country-flag-icons/react/3x2/NL";
import PT from "country-flag-icons/react/3x2/PT";
import SE from "country-flag-icons/react/3x2/SE";
import { Check, ChevronDown } from "lucide-react";
import { useId, useMemo, useState } from "react";
import {
  isSupportedCountry,
  SUPPORTED_COUNTRIES,
} from "@/lib/venueEditorOptions";

const flags = { AE, BE, DE, ES, FR, GB, IT, NL, PT, SE } as const;

type CountryComboboxProps = {
  initialValue: string;
  invalid?: boolean;
  describedBy?: string;
};

export default function CountryCombobox({
  initialValue,
  invalid,
  describedBy,
}: CountryComboboxProps) {
  const initialCountry = isSupportedCountry(initialValue) ? initialValue : "";
  const [selected, setSelected] = useState(initialCountry);
  const [query, setQuery] = useState(initialCountry);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(
      SUPPORTED_COUNTRIES.findIndex(
        (country) => country.value === initialCountry
      ),
      0
    )
  );
  const listboxId = useId();

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search || query === selected) return [...SUPPORTED_COUNTRIES];
    return SUPPORTED_COUNTRIES.filter((country) =>
      country.label.toLowerCase().includes(search)
    );
  }, [query, selected]);

  function choose(value: string) {
    if (!isSupportedCountry(value)) return;
    setSelected(value);
    setQuery(value);
    setOpen(false);
    setActiveIndex(0);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) =>
        !open
          ? 0
          : filtered.length
            ? Math.min(current + 1, filtered.length - 1)
            : 0
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) =>
        !open
          ? Math.max(filtered.length - 1, 0)
          : filtered.length
            ? Math.max(current - 1, 0)
            : 0
      );
    } else if (event.key === "Enter" && open && filtered[activeIndex]) {
      event.preventDefault();
      choose(filtered[activeIndex].value);
    } else if (event.key === "Escape") {
      setOpen(false);
      setQuery(selected);
    }
  }

  return (
    <div
      className="relative mt-1.5"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setQuery(selected);
        }
      }}
    >
      <input type="hidden" name="country" value={selected} />
      <div className="relative">
        <input
          id="venue-country-search"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={
            open && filtered[activeIndex]
              ? `${listboxId}-${filtered[activeIndex].code}`
              : undefined
          }
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-required="true"
          value={query}
          placeholder="Search supported countries"
          autoComplete="off"
          onFocus={() => {
            setOpen(true);
            setActiveIndex(
              Math.max(
                filtered.findIndex((country) => country.value === selected),
                0
              )
            );
          }}
          onKeyDown={onKeyDown}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected("");
            setOpen(true);
            setActiveIndex(0);
          }}
          className="w-full rounded-xl border border-primary/15 bg-white px-3.5 py-3 pr-10 text-base text-primary outline-none transition placeholder:text-primary/35 focus:border-primary/35 focus:ring-2 focus:ring-primary/10"
        />
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/45"
          aria-hidden
        />
      </div>

      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Supported countries"
          className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-primary/10 bg-white p-1.5 shadow-xl"
        >
          {filtered.length ? (
            filtered.map((country, index) => {
              const Flag = flags[country.code];
              const active = index === activeIndex;
              const isSelected = country.value === selected;
              return (
                <li
                  key={country.value}
                  id={`${listboxId}-${country.code}`}
                  role="option"
                  aria-selected={isSelected}
                >
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(country.value)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                      active ? "bg-surface text-primary" : "text-primary/75"
                    }`}
                  >
                    <Flag
                      className="h-4 w-6 shrink-0 rounded-[2px] object-cover"
                      aria-hidden
                    />
                    <span className="flex-1">{country.label}</span>
                    {isSelected ? (
                      <Check className="h-4 w-4 text-primary" aria-hidden />
                    ) : null}
                  </button>
                </li>
              );
            })
          ) : (
            <li className="px-3 py-3 text-sm text-primary/55">
              No supported country matches.
            </li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
