import Image from "next/image";
import Link from "next/link";
import { Building2, Dumbbell, MapPin, Star } from "lucide-react";
import CardArrowButton from "./CardArrowButton";

export type HomeFeaturedVenueCardProps = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  imageUrl?: string | null;
  rating?: number | string | null;
  courts?: number | null;
  coachingAvailable?: boolean | null;
  courtType?: string | null;
  distanceMiles?: number | null;
  badgeLabel?: string;
  className?: string;
};

function formatRating(raw: number | string | null | undefined) {
  const n = typeof raw === "string" ? Number(raw) : raw;
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  return n.toFixed(1);
}

function getSurfaceType(raw?: string | null) {
  if (!raw) return null;
  const value = raw.toLowerCase();
  if (value.includes("indoor")) return "Indoor";
  if (value.includes("outdoor")) return "Outdoor";
  return raw;
}

export default function HomeFeaturedVenueCard({
  id,
  name,
  city,
  country,
  imageUrl,
  rating,
  courts,
  coachingAvailable,
  courtType,
  distanceMiles,
  badgeLabel = "Top venue",
  className = "",
}: HomeFeaturedVenueCardProps) {
  const imageSrc = imageUrl?.trim() || "/images/venue-default.png";
  const location = [city, country].filter(Boolean).join(", ");
  const ratingLabel = formatRating(rating);
  const surfaceType = getSurfaceType(courtType);
  const courtsLabel =
    typeof courts === "number" && courts > 0 ? `${courts} court${courts === 1 ? "" : "s"}` : null;
  const distanceLabel =
    typeof distanceMiles === "number" && distanceMiles > 0
      ? `${distanceMiles === 1 ? "1 mile" : `${distanceMiles} miles`} away`
      : null;

  const locationParts = [location, courtsLabel].filter(Boolean);
  const locationLine = locationParts.join(" · ");

  return (
    <Link
      href={`/venue/${encodeURIComponent(id)}`}
      className={[
        "group relative flex min-h-[331px] flex-col justify-end overflow-hidden rounded-[20px] p-5",
        "transition duration-300 ease-out hover:scale-[1.01] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2",
        className,
      ].join(" ")}
    >
      <Image
        src={imageSrc}
        alt=""
        fill
        className="object-cover transition duration-500 group-hover:scale-[1.03]"
        sizes="(max-width: 1024px) 100vw, 401px"
      />
      <div
        className="absolute inset-0 bg-gradient-to-b from-[rgba(2,16,16,0)] via-[rgba(2,16,16,0.7)] via-[72%] to-[rgba(2,16,16,0.85)]"
        aria-hidden
      />

      <span className="absolute left-4 top-4 z-10 rounded-full bg-accent px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
        {badgeLabel}
      </span>

      {ratingLabel ? (
        <div className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-full bg-surface px-2 py-1 text-sm font-medium text-primary shadow-sm">
          <Star className="h-3.5 w-3.5 fill-primary text-primary" aria-hidden />
          <span>{ratingLabel}</span>
        </div>
      ) : null}

      <div className="relative z-10 space-y-4">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-surface">{name}</h3>
          {locationLine ? (
            <p className="flex items-start gap-2 text-[15px] text-surface/90">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                {locationLine}
                {distanceLabel ? (
                  <>
                    <span className="text-surface/70"> · </span>
                    <span className="text-surface/70">{distanceLabel}</span>
                  </>
                ) : null}
              </span>
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-[15px] text-surface/80">
            {coachingAvailable ? (
              <span className="inline-flex items-center gap-1">
                <Dumbbell className="h-4 w-4" aria-hidden />
                Coaching
              </span>
            ) : null}
            {surfaceType ? (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-4 w-4" aria-hidden />
                {surfaceType}
              </span>
            ) : null}
          </div>
          <CardArrowButton />
        </div>
      </div>
    </Link>
  );
}