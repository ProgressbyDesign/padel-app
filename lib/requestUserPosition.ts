/**
 * Requests browser geolocation once. User must trigger via a gesture (e.g. "Nearby" click).
 * Resolves null on deny, timeout, or unsupported environments — never throws.
 */
export function requestUserPosition(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      () => resolve(null),
      {
        enableHighAccuracy: false,
        maximumAge: 60_000,
        timeout: 12_000,
      }
    );
  });
}
