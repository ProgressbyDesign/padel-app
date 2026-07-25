"use client";

import { useMemo, useSyncExternalStore } from "react";
import { addDistancesToVenues } from "../lib/distance";
import type { Venue } from "../lib/venueFilters";
import {
  getUserGeoServerSnapshot,
  getUserGeoSnapshot,
  subscribeUserGeo,
} from "../lib/userGeoSession";
import type { UserGeolocation } from "../hooks/useUserGeolocation";
import VenueCard from "./VenueCard";

type VenueCardsWithDistanceProps = {
  venues: Venue[];
  className: string;
  /** When set, used for distances; otherwise reads last session coords after mount (no geolocation prompt). */
  userCoords?: UserGeolocation;
};

export default function VenueCardsWithDistance({
  venues,
  className,
  userCoords: userCoordsProp,
}: VenueCardsWithDistanceProps) {
  const sessionCoords = useSyncExternalStore(
    subscribeUserGeo,
    getUserGeoSnapshot,
    getUserGeoServerSnapshot
  );

  const effectiveCoords =
    userCoordsProp !== undefined ? userCoordsProp : sessionCoords;

  const venuesWithDistance = useMemo(
    () => addDistancesToVenues(venues, effectiveCoords),
    [venues, effectiveCoords]
  );

  return (
    <div className={className}>
      {venuesWithDistance.map((venue) => (
        <VenueCard key={venue.id} venue={venue} />
      ))}
    </div>
  );
}
