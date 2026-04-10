"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Search, X } from "lucide-react";
import type { WhereOption } from "../lib/venueFilters";

type HeroWhereSearchProps = {
  whereOptions: WhereOption[];
};

export default function HeroWhereSearch({ whereOptions }: HeroWhereSearchProps) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = value.trim().toLowerCase();
  const filteredSuggestions = useMemo(() => {
    if (!q) return whereOptions;
    return whereOptions.filter((o) => o.label.toLowerCase().includes(q));
  }, [whereOptions, q]);

  const closeDropdown = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) closeDropdown();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, closeDropdown]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDropdown();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeDropdown]);

  function goToVenues() {
    const v = value.trim();
    closeDropdown();
    if (v) router.push(`/venues?location=${encodeURIComponent(v)}`);
    else router.push("/venues");
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); goToVenues(); }} className="mx-auto w-full max-w-xl">
      <div ref={wrapRef} className="relative">
        <div className="flex items-center gap-1 overflow-hidden rounded-full border border-white/20 bg-white/95 py-1 pl-2 pr-1 shadow-xl shadow-black/20 backdrop-blur-md transition hover:bg-white">
          <MapPin className="ml-1 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
          <div className="relative min-w-0 flex-1">
            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder="Where do you want to play?"
              autoComplete="off"
              aria-autocomplete="list"
              className={`w-full bg-transparent py-2.5 pl-1 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none ${value ? "pr-10" : "pr-2"}`}
              aria-label="Where do you want to play?"
            />
            {value ? (
              <button
                type="button"
                onClick={() => {
                  setValue("");
                  inputRef.current?.focus();
                }}
                className="absolute right-1 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="Clear"
              >
                <X className="h-4 w-4" strokeWidth={2.25} />
              </button>
            ) : null}
          </div>
          <button
            type="submit"
            className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <Search className="h-4 w-4 sm:hidden" aria-hidden />
            <span className="hidden sm:inline">Search</span>
          </button>
        </div>

        {open ? (
          <div
            className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-72 overflow-y-auto rounded-2xl border border-slate-200/90 bg-white py-1 shadow-lg ring-1 ring-black/5"
            role="listbox"
            aria-label="Location suggestions"
          >
            <button
              type="button"
              role="option"
              aria-selected={!value.trim()}
              onClick={() => {
                setValue("");
                closeDropdown();
              }}
              className="flex w-full px-3 py-2.5 text-left text-sm text-slate-600 transition hover:bg-slate-50"
            >
              Anywhere
            </button>
            {filteredSuggestions.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-slate-500">No suggestions — press Search to explore</div>
            ) : (
              filteredSuggestions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  aria-selected={value.trim().toLowerCase() === opt.label.toLowerCase()}
                  onClick={() => {
                    setValue(opt.label);
                    closeDropdown();
                  }}
                  className="flex w-full px-3 py-2.5 text-left text-sm text-slate-900 transition hover:bg-slate-50"
                >
                  <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                  <span className="ml-2 shrink-0 text-xs text-slate-400">{opt.kind === "country" ? "Country" : "City"}</span>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
    </form>
  );
}
