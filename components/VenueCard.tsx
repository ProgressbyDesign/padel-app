import { MapPin, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { VenueWithDistance } from "../lib/distance";
import {
  buildVenueSecondaryAttributes,
  formatDistanceMiles,
  formatVenueCourtsLabel,
  joinDotLabels,
} from "../lib/listingCardLabels";

type VenueCardProps = {
  venue: VenueWithDistance;
  badgeLabel?: string | null;
};

function formatRating(raw: VenueCardProps["venue"]["rating"]) {
  const n = typeof raw === "string" ? Number(raw) : raw;
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  return n.toFixed(1);
}

export default function VenueCard({ venue, badgeLabel }: VenueCardProps) {
  const imageSrc = venue.image_url || "/images/venue-default.png";
  const location = [venue.city, venue.country].filter(Boolean).join(", ");
  const distanceMiles = typeof venue.distance === "number" ? venue.distance : null;
  const rating = formatRating(venue.rating);
  const primaryValue = formatVenueCourtsLabel(venue.courts);
  const secondaryAttributes = joinDotLabels(
    buildVenueSecondaryAttributes({
      coachingAvailable: venue.coaching_available,
      courtType: venue.court_type,
      max: 2,
    })
  );

  return (
    <Link
      href={`/venue/${encodeURIComponent(String(venue.id))}`}
      className="group/card block h-full overflow-hidden rounded-[20px] bg-white transition duration-200 hover:shadow-[0_8px_24px_rgba(3,19,34,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2"
    >
      <article className="flex h-full flex-col">
        <div className="relative h-[247px] w-full overflow-hidden rounded-t-[12px] bg-surface">
          <Image
            src={imageSrc}
            alt={venue.name ? `${venue.name} venue` : "Padel venue"}
            fill
            sizes="(max-width: 768px) 88vw, 344px"
            className="object-cover transition duration-300 ease-out group-hover/card:scale-[1.02]"
          />

          {badgeLabel ? (
            <span className="absolute left-4 top-4 z-10 rounded-full bg-dark px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-surface">
              {badgeLabel}
            </span>
          ) : null}

          {rating ? (
            <div className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-full bg-surface px-2 py-1 text-base font-medium text-primary shadow-sm">
              <Star className="h-3.5 w-3.5 fill-primary text-primary" aria-hidden />
              <span>{rating}</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-4 px-4 pb-5 pt-4">
          <div className="space-y-3">
            <p className="line-clamp-2 text-lg font-semibold tracking-[-0.18px] text-primary">
              {venue.name || "Venue"}
            </p>

            {location || distanceMiles != null ? (
              <p className="flex items-start gap-1.5 text-[15px] leading-normal">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-icon" aria-hidden />
                <span>
                  {location ? <span className="text-primary">{location}</span> : null}
                  {location && distanceMiles != null ? (
                    <span className="text-icon"> · </span>
                  ) : null}
                  {distanceMiles != null ? (
                    <span className="text-icon">{formatDistanceMiles(distanceMiles)}</span>
                  ) : null}
                </span>
              </p>
            ) : null}

            {primaryValue ? (
              <p className="text-[15px] font-medium leading-4 text-primary">{primaryValue}</p>
            ) : null}

            {secondaryAttributes ? (
              <p className="text-sm leading-[14px] text-icon">{secondaryAttributes}</p>
            ) : null}
          </div>
        </div>
      </article>
    </Link>
  );
}