"use client";

/** Coordinates from a user-triggered geolocation request (see `requestUserPosition`). */
export type UserGeolocation = {
  latitude: number;
  longitude: number;
} | null;
