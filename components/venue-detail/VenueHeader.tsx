"use client";

import Link from "next/link";
import { ArrowLeft, MapPin, Star } from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";
import { getDistanceInMiles } from "../../lib/distance";
import type { Venue } from "../../lib/venueFilters";
import { formatRatingValue } from "../../lib/venueDetailHelpers";
import {
  getUserGeoServerSnapshot,
  getUserGeoSnapshot,
  subscribeUserGeo,
} from "../../lib/userGeoSession";

type VenueHeaderProps = {
  venue: Venue;
};

function distanceLabel(miles: number) {
  if (miles === 1) return "1 mile away";
  return `${miles} miles away`;
}

export default function VenueHeader({ venue }: VenueHeaderProps) {
  const sessionCoords = useSyncExternalStore(
    subscribeUserGeo,
    getUserGeoSnapshot,
    getUserGeoServerSnapshot
  );

  const locationLine = [venue.city, venue.country].filter(Boolean).join(", ");
  const ratingStr = formatRatingValue(venue.rating);
  const reviewCount =
    typeof venue.review_count === "number" && venue.review_count > 0
      ? venue.review_count.toLocaleString()
      : null;
  const coachingAvailable = Boolean(venue.coaching_available);

  const distanceMiles = useMemo(() => {
    if (!sessionCoords) return null;
    const lat =
      typeof venue.lat === "number"
        ? venue.lat
        : venue.lat != null
          ? Number(venue.lat)
          : NaN;
    const lng =
      typeof venue.lng === "number"
        ? venue.lng
        : venue.lng != null
          ? Number(venue.lng)
          : NaN;
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return getDistanceInMiles(
      sessionCoords.latitude,
      sessionCoords.longitude,
      lat,
      lng
    );
  }, [sessionCoords, venue.lat, venue.lng]);

  return (
    <header className="space-y-4">
      <Link
        href="/venues"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary/70 transition hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to venues
      </Link>

      <div className="space-y-3">
        <h1>{venue.name?.trim() || "Venue"}</h1>

        {coachingAvailable ? (
          <p className="inline-flex items-center gap-2 rounded-full bg-secondary/20 px-3 py-1 text-sm font-semibold text-primary ring-1 ring-secondary/35">
            Coaching available
          </p>
        ) : null}

        {venue.is_approved ? (
          <p className="inline-flex items-center rounded-lg border border-primary/12 bg-surface px-2.5 py-1 text-xs font-semibold text-primary/80">
            Verified venue
          </p>
        ) : null}

        {locationLine ? (
          <p className="flex flex-wrap items-center gap-1.5 text-base text-primary/70">
            <MapPin className="h-4 w-4 shrink-0 text-secondary" aria-hidden />
            <span>{locationLine}</span>
            {distanceMiles != null ? (
              <>
                <span className="text-primary/45" aria-hidden>
                  ·
                </span>
                <span className="font-semibold text-primary">
                  {distanceLabel(distanceMiles)}
                </span>
              </>
            ) : null}
          </p>
        ) : null}

        {ratingStr ? (
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
              <Star className="h-4 w-4 fill-secondary text-secondary" aria-hidden />
              {ratingStr}
              {reviewCount ? (
                <span className="font-normal text-primary/60">
                  ({reviewCount} reviews)
                </span>
              ) : null}
            </span>
          </div>
        ) : (
          <p className="text-sm text-primary/60">No rating yet</p>
        )}
      </div>
    </header>
  );
}
