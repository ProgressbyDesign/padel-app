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
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const res = await fetch("/api/coaches/top-rated");
        const json = (await res.json()) as {
          coaches?: CoachListingItem[];
        };
        if (!res.ok) throw new Error("Request failed");
        if (cancelled) return;
        setCoaches(json.coaches ?? []);
        setError(null);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setError("Failed to load coaches");
        setCoaches([]);
        setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRequestId((id) => id + 1);
  }, []);

  return { coaches, loading, error, refetch };
}
