"use client";

import Link from "next/link";
import { ArrowLeft, MapPin, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getDistanceInMiles } from "../../lib/distance";
import type { Venue } from "../../lib/venueFilters";
import { formatRatingValue } from "../../lib/venueDetailHelpers";
import { readUserGeo } from "../../lib/userGeoSession";
import type { UserGeolocation } from "../../hooks/useUserGeolocation";

type VenueHeaderProps = {
  venue: Venue;
};

function distanceLabel(miles: number) {
  if (miles === 1) return "1 mile away";
  return `${miles} miles away`;
}

export default function VenueHeader({ venue }: VenueHeaderProps) {
  const [sessionCoords, setSessionCoords] = useState<UserGeolocation>(null);

  useEffect(() => {
    setSessionCoords(readUserGeo());
  }, []);

  const locationLine = [venue.city, venue.country].filter(Boolean).join(", ");
  const ratingStr = formatRatingValue(venue.rating);
  const reviewCount =
    typeof venue.review_count === "number" && venue.review_count > 0
      ? venue.review_count.toLocaleString()
      : null;
  const coachingAvailable = Boolean(venue.coaching_available);

  const distanceMiles = useMemo(() => {
    if (!sessionCoords) return null;
    const lat = typeof venue.lat === "number" ? venue.lat : venue.lat != null ? Number(venue.lat) : NaN;
    const lng = typeof venue.lng === "number" ? venue.lng : venue.lng != null ? Number(venue.lng) : NaN;
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return getDistanceInMiles(sessionCoords.latitude, sessionCoords.longitude, lat, lng);
  }, [sessionCoords, venue.lat, venue.lng]);

  return (
    <header className="space-y-4">
      <Link
        href="/venues"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to venues
      </Link>

      <div className="space-y-3">
        <h1 className="font-adobe-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          {venue.name?.trim() || "Venue"}
        </h1>

        {coachingAvailable ? (
          <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-900 ring-1 ring-emerald-100">
            <span aria-hidden>🎾</span>
            Coaching available
          </p>
        ) : null}

        {locationLine ? (
          <p className="flex flex-wrap items-center gap-1.5 text-base text-slate-600">
            <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <span>{locationLine}</span>
            {distanceMiles != null ? (
              <>
                <span className="text-slate-400" aria-hidden>
                  ·
                </span>
                <span className="font-semibold text-slate-900">{distanceLabel(distanceMiles)}</span>
              </>
            ) : null}
          </p>
        ) : null}

        {ratingStr ? (
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Star className="h-4 w-4 fill-neutral-900 text-neutral-900" aria-hidden />
              {ratingStr}
              {reviewCount ? <span className="font-normal text-slate-500">({reviewCount} reviews)</span> : null}
            </span>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No rating yet</p>
        )}
      </div>
    </header>
  );
}
