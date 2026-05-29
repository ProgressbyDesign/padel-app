"use client";

import { useEffect, useState } from "react";

export type MarketplaceCounts = {
  venueCount: number | null;
  coachCount: number | null;
};

const EMPTY: MarketplaceCounts = { venueCount: null, coachCount: null };

// Module-level cache so the counts are fetched once per session and shared
// across every search instance (hero, sticky, PLPs, mobile modal).
let cache: MarketplaceCounts | null = null;
let inflight: Promise<MarketplaceCounts> | null = null;

async function loadCounts(): Promise<MarketplaceCounts> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/api/stats/counts")
    .then((r) => (r.ok ? r.json() : EMPTY))
    .then((data: MarketplaceCounts) => {
      cache = {
        venueCount: typeof data.venueCount === "number" ? data.venueCount : null,
        coachCount: typeof data.coachCount === "number" ? data.coachCount : null,
      };
      return cache;
    })
    .catch(() => EMPTY)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useMarketplaceCounts(): MarketplaceCounts {
  const [counts, setCounts] = useState<MarketplaceCounts>(cache ?? EMPTY);

  useEffect(() => {
    let active = true;
    void loadCounts().then((c) => {
      if (active) setCounts(c);
    });
    return () => {
      active = false;
    };
  }, []);

  return counts;
}
