"use client";

import { useMemo } from "react";
import { addDistancesToVenues } from "../lib/distance";
import type { Venue } from "../lib/venueFilters";
import { useUserGeolocation } from "../hooks/useUserGeolocation";
import VenueCard from "./VenueCard";

type VenueCardsWithDistanceProps = {
  venues: Venue[];
  className: string;
};

export default function VenueCardsWithDistance({ venues, className }: VenueCardsWithDistanceProps) {
  const userPosition = useUserGeolocation();
  const venuesWithDistance = useMemo(
    () => addDistancesToVenues(venues, userPosition),
    [venues, userPosition]
  );

  return (
    <div className={className}>
      {venuesWithDistance.map((venue) => (
        <VenueCard key={venue.id} venue={venue} />
      ))}
    </div>
  );
}
