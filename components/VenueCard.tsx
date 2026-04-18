import { Building2, Dumbbell, MapPin, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { VenueWithDistance } from "../lib/distance";

type VenueCardProps = {
  venue: VenueWithDistance;
};

function formatRating(raw: VenueCardProps["venue"]["rating"]) {
  const n = typeof raw === "string" ? Number(raw) : raw;
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  return n.toFixed(1);
}

function getSurfaceType(raw?: string | null) {
  if (!raw) return "Unknown";
  const value = raw.toLowerCase();
  if (value.includes("indoor")) return "Indoor";
  if (value.includes("outdoor")) return "Outdoor";
  return raw;
}

function distanceLabel(miles: number) {
  if (miles === 1) return "1 mile away";
  return `${miles} miles away`;
}

export default function VenueCard({ venue }: VenueCardProps) {
  const imageSrc = venue.image_url || "/images/venue-default.png";
  const location = [venue.city, venue.country].filter(Boolean).join(", ");
  const distanceMiles = typeof venue.distance === "number" ? venue.distance : null;
  const rating = formatRating(venue.rating);
  const surfaceType = getSurfaceType(venue.court_type);
  const hasCoaching = Boolean(venue.coaching_available);

  const iconMuted = "h-4 w-4 shrink-0 text-[#6e6d6c]";

  return (
    <Link
      href={`/venue/${encodeURIComponent(String(venue.id))}`}
      className="group/card font-adobe-body block rounded-[20px] bg-white pt-2 pr-2 pb-4 pl-2 shadow-[0_2px_8px_rgba(15,23,42,0.06)] ring-1 ring-neutral-200/80 transition duration-200 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] hover:ring-neutral-300/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20 focus-visible:ring-offset-2"
    >
      <article className="flex flex-col gap-5">
        <div className="relative aspect-[313/181] w-full shrink-0 overflow-hidden rounded-xl bg-neutral-100">
          <Image
            src={imageSrc}
            alt={venue.name ? `${venue.name} venue` : "Padel venue"}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
            className="object-cover transition duration-300 ease-out group-hover/card:scale-[1.02]"
          />
        </div>

        <div className="flex w-full flex-col gap-3 px-2">
          <div className="flex items-start justify-between gap-3">
            <p className="font-adobe-body line-clamp-2 min-w-0 flex-1 text-[20px] leading-tight tracking-[-0.2px] text-[#020d0c]">
              {venue.name || "Venue"}
            </p>
            {rating ? (
              <div className="flex shrink-0 items-center gap-[9px] pt-0.5">
                <Star className="h-[14px] w-[14px] fill-neutral-900 text-neutral-900" aria-hidden />
                <span className="text-[16px] font-normal leading-normal tracking-[-0.16px] text-[#a19f9e]">
                  {rating}
                </span>
              </div>
            ) : null}
          </div>

          {location ? (
            <div className="flex w-full items-center gap-2">
              <MapPin className={iconMuted} aria-hidden />
              <p className="min-w-0 flex-1 text-[14px] leading-normal tracking-[-0.14px] text-[#6e6d6c] line-clamp-2">
                <span>{location}</span>
                {distanceMiles != null ? (
                  <>
                    <span> · </span>
                    <span className="font-semibold text-[#020d0c]">{distanceLabel(distanceMiles)}</span>
                  </>
                ) : null}
              </p>
            </div>
          ) : null}

          <div className="flex min-w-0 flex-wrap items-center gap-4">
            {hasCoaching ? (
              <div className="flex items-center gap-2">
                <Dumbbell className={iconMuted} aria-hidden />
                <span className="text-[14px] leading-[14px] tracking-[-0.14px] text-[#6e6d6c]">Coaching</span>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <Building2 className={iconMuted} aria-hidden />
              <span className="text-[14px] leading-[14px] tracking-[-0.14px] text-[#6e6d6c]">{surfaceType}</span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
