"use client";

import { useEffect, useState } from "react";

export type UserGeolocation = {
  latitude: number;
  longitude: number;
} | null;

/**
 * Reads the browser geolocation once. On denial, timeout, or missing API, returns null.
 * Does not block render — starts as null until a callback runs.
 */
export function useUserGeolocation(): UserGeolocation {
  const [position, setPosition] = useState<UserGeolocation>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      () => {
        setPosition(null);
      },
      {
        enableHighAccuracy: false,
        maximumAge: 60_000,
        timeout: 12_000,
      }
    );
  }, []);

  return position;
}
