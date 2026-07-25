"use client";

import { useMemo, useState } from "react";
import { listSearchableTimeZones } from "@/lib/coachAvailability/timezone";

export default function TimezoneCombobox({
  value,
  onChange,
  suggested,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  suggested?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(value);
  const options = useMemo(() => listSearchableTimeZones(query), [query]);

  return (
    <div>
      <label className="block text-sm font-semibold text-primary">
        Timezone
        <input
          type="search"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          onBlur={() => {
            if (value) setQuery(value);
          }}
          placeholder="Europe/Madrid"
          list="availability-timezones"
          className="mt-2 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2.5 text-sm font-normal outline-none focus:border-primary/40"
        />
      </label>
      <datalist id="availability-timezones">
        {options.map((zone) => (
          <option key={zone} value={zone} />
        ))}
      </datalist>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || !query.trim()}
          onClick={() => onChange(query.trim())}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-accent disabled:opacity-60"
        >
          Use “{query.trim() || "timezone"}”
        </button>
        {suggested && suggested !== value ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setQuery(suggested);
              onChange(suggested);
            }}
            className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-semibold text-primary/70"
          >
            Suggest {suggested}
          </button>
        ) : null}
      </div>
      {value ? (
        <p className="mt-2 text-xs text-primary/55">Selected: {value}</p>
      ) : (
        <p className="mt-2 text-xs text-amber-800">
          Confirm a timezone before saving. Browser time is not used as the venue timezone.
        </p>
      )}
    </div>
  );
}
