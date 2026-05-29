"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Building2, Check, ChevronDown, UserRound } from "lucide-react";
import {
  modeCountLabel,
  modeOptionHelper,
  searchModeLabel,
  type SearchMode,
} from "../../lib/marketplaceSearch";

type SearchModeSelectProps = {
  mode: SearchMode;
  onChange: (mode: SearchMode) => void;
  venueCount: number | null;
  coachCount: number | null;
  variant?: "hero" | "listing" | "compact";
  className?: string;
};

const MODES: SearchMode[] = ["venues", "coaches"];

function ModeIcon({ mode, className }: { mode: SearchMode; className?: string }) {
  return mode === "venues" ? (
    <Building2 className={className} aria-hidden />
  ) : (
    <UserRound className={className} aria-hidden />
  );
}

export default function SearchModeSelect({
  mode,
  onChange,
  venueCount,
  coachCount,
  variant = "listing",
  className = "",
}: SearchModeSelectProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<number>(MODES.indexOf(mode));
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const isCompact = variant === "compact";
  const countFor = (m: SearchMode) => (m === "venues" ? venueCount : coachCount);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open) setHighlight(MODES.indexOf(mode));
  }, [open, mode]);

  const select = (m: SearchMode) => {
    onChange(m);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlight((h) => (h + (e.key === "ArrowDown" ? 1 : MODES.length - 1)) % MODES.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open) select(MODES[highlight]);
      else setOpen(true);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const triggerClass = isCompact
    ? "flex h-11 w-full items-center justify-between gap-2 rounded-lg bg-surface px-3 text-sm font-semibold text-primary transition hover:bg-surface/80 lg:h-full lg:min-w-[8rem] lg:rounded-none lg:bg-transparent lg:hover:bg-surface/60"
    : variant === "hero"
      ? "flex h-12 w-full items-center justify-between gap-2 rounded-xl bg-surface/80 px-3 text-sm font-semibold text-primary transition hover:bg-surface sm:h-full sm:w-auto sm:min-w-[11rem] sm:rounded-full sm:bg-transparent sm:px-4 sm:hover:bg-surface/60"
      : "flex h-11 w-full items-center justify-between gap-2 rounded-lg bg-surface px-3 text-sm font-semibold text-primary transition hover:bg-surface/80 lg:h-full lg:min-w-[10.5rem] lg:rounded-none lg:bg-transparent lg:hover:bg-surface/60";

  return (
    <div ref={wrapRef} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={triggerClass}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Search for ${searchModeLabel(mode).toLowerCase()}`}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ModeIcon mode={mode} className="h-4 w-4" />
          </span>
          <span className="flex min-w-0 flex-col text-left leading-tight">
            <span className="truncate">{searchModeLabel(mode)}</span>
            {!isCompact ? (
              <span className="truncate text-[11px] font-medium text-primary/55">
                {modeCountLabel(mode, countFor(mode))}
              </span>
            ) : null}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-primary/45 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Search mode"
          className="absolute left-0 top-[calc(100%+8px)] z-50 w-[16rem] max-w-[80vw] overflow-hidden rounded-2xl border border-primary/15 bg-white p-1.5 shadow-xl ring-1 ring-black/5"
        >
          {MODES.map((m, i) => {
            const selected = m === mode;
            const active = i === highlight;
            return (
              <li key={m} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => select(m)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                    selected
                      ? "bg-accent/15 ring-1 ring-accent/40"
                      : active
                        ? "bg-surface"
                        : "hover:bg-surface"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      selected ? "bg-primary text-white" : "bg-primary/10 text-primary"
                    }`}
                  >
                    <ModeIcon mode={m} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-primary">
                      {searchModeLabel(m)}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-primary/60">
                      {modeOptionHelper(m, countFor(m))}
                    </span>
                  </span>
                  {selected ? (
                    <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
