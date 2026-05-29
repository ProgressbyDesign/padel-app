"use client";

import { useCallback, useEffect, useState } from "react";
import type { CoachListingItem } from "../lib/coachListing";

type TopRatedState = {
  coaches: CoachListingItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

/**
 * Client fetch for top-rated coaches (same Supabase rules as homepage).
 * Prefer server components + `fetchTopRatedCoachesForHome` when possible.
 */
export function useTopRatedCoaches(): TopRatedState {
  const [coaches, setCoaches] = useState<CoachListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/coaches/top-rated");
      const json = (await res.json()) as {
        coaches?: CoachListingItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Request failed");
      setCoaches(json.coaches ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load coaches");
      setCoaches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { coaches, loading, error, refetch: load };
}
