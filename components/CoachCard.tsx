import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import type { CoachSkillLevel } from "../lib/coaches";
import {
  buildCoachAttributeLabels,
  formatDistanceMiles,
  joinDotLabels,
  primaryCoachFocus,
} from "../lib/listingCardLabels";
import CardArrowButton from "./home/CardArrowButton";

export type { CoachSkillLevel };

export type CoachCardProps = {
  name: string;
  avatarImage?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  level?: CoachSkillLevel | string | null;
  locationCity?: string | null;
  locationCountry?: string | null;
  experienceYears?: number | null;
  audience?: string[];
  travelAvailable?: boolean;
  outcomes?: string | null;
  outcomeTags?: string[];
  priceFrom?: string | null;
  href: string;
  className?: string;
  variant?: "default" | "featured";
  badgeLabel?: string | null;
  distanceMiles?: number | null;
  showArrowCta?: boolean;
};

function formatRating(rating: number): string {
  if (Number.isInteger(rating)) return String(rating);
  return rating.toFixed(1);
}

function skipLocationPart(value?: string | null): boolean {
  const trimmed = value?.trim();
  return !trimmed || trimmed.toLowerCase() === "unknown" || trimmed === "—";
}

function levelBadgeClass(level: string): string {
  const key = level.toLowerCase();
  if (key === "pro") return "bg-[#021010] text-accent";
  return "bg-[#021010] text-accent";
}

function ListingCoachCard({
  name,
  avatarImage,
  rating,
  level,
  locationCity,
  locationCountry,
  audience,
  travelAvailable,
  outcomes,
  outcomeTags,
  priceFrom,
  href,
  className = "",
  badgeLabel,
  distanceMiles,
  showArrowCta = true,
}: CoachCardProps) {
  const locationLine = [locationCity, locationCountry]
    .filter((part) => !skipLocationPart(part))
    .join(", ");
  const focusLine = primaryCoachFocus({ outcomeTags, outcomes });
  const attributeLabels = buildCoachAttributeLabels({ audience, travelAvailable, max: 2 });
  const attributesLine = joinDotLabels(attributeLabels);
  const levelLabel = level?.trim();
  const showRating = typeof rating === "number" && !Number.isNaN(rating);
  const distanceNote =
    typeof distanceMiles === "number" && distanceMiles > 0
      ? formatDistanceMiles(distanceMiles)
      : null;
  const priceText = priceFrom?.trim() ?? null;

  return (
    <Link
      href={href}
      aria-label={`View profile for ${name}`}
      className={[
        "group/coach block h-full overflow-hidden rounded-[20px] bg-white transition duration-200",
        "hover:shadow-[0_8px_24px_rgba(3,19,34,0.08)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2",
        className,
      ].join(" ")}
    >
      <article className="flex h-full flex-col">
        <div className="relative aspect-[285/298] w-full overflow-hidden rounded-t-[12px] bg-surface">
          {avatarImage?.trim() ? (
            <img
              src={avatarImage.trim()}
              alt={`${name}, padel coach`}
              className="absolute inset-0 h-full w-full object-cover object-[center_20%] transition duration-300 group-hover/coach:scale-[1.02]"
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface to-primary/10"
              aria-hidden
            >
              <span className="text-4xl font-semibold tracking-tight text-primary/35">
                {name.slice(0, 1).toUpperCase() || "?"}
              </span>
            </div>
          )}

          {badgeLabel ? (
            <span className="absolute left-4 top-4 z-10 rounded-full bg-dark px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-surface">
              {badgeLabel}
            </span>
          ) : null}

          {showRating ? (
            <div className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-full bg-surface px-2 py-1 text-base font-medium text-primary shadow-sm">
              <Star className="h-3.5 w-3.5 fill-primary text-primary" aria-hidden />
              <span>{formatRating(rating)}</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-4 px-4 pb-5 pt-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold leading-tight text-primary">{name}</h3>
              {levelLabel ? (
                <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">
                  {levelLabel}
                </span>
              ) : null}
            </div>

            {locationLine || distanceNote ? (
              <p className="flex items-start gap-1.5 text-[15px] leading-normal">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-icon" aria-hidden />
                <span>
                  {locationLine ? <span className="text-primary">{locationLine}</span> : null}
                  {locationLine && distanceNote ? (
                    <span className="text-icon"> · </span>
                  ) : null}
                  {distanceNote ? <span className="text-icon">{distanceNote}</span> : null}
                </span>
              </p>
            ) : null}

            {focusLine ? (
              <p className="text-[15px] font-medium leading-4 text-primary">{focusLine}</p>
            ) : null}

            {attributesLine ? (
              <p className="text-sm leading-[14px] text-icon">{attributesLine}</p>
            ) : null}
          </div>

          {priceText || showArrowCta ? (
            <div className="relative mt-auto flex items-center justify-between gap-3 pt-1">
              {priceText ? (
                <p className="text-[13px] text-icon">
                  From <span className="text-base font-semibold text-primary">{priceText}</span>
                </p>
              ) : (
                <span />
              )}
              {showArrowCta ? <CardArrowButton className="shrink-0" /> : null}
            </div>
          ) : null}
        </div>
      </article>
    </Link>
  );
}

function FeaturedCoachCard({
  name,
  avatarImage,
  rating,
  level,
  locationCity,
  locationCountry,
  outcomes,
  outcomeTags,
  priceFrom,
  href,
  className = "",
  badgeLabel,
  distanceMiles,
}: CoachCardProps) {
  const locationLine = [locationCity, locationCountry]
    .filter((part) => !skipLocationPart(part))
    .join(", ");
  const focusLine = primaryCoachFocus({ outcomeTags, outcomes });
  const levelLabel = level?.trim();
  const showRating = typeof rating === "number" && !Number.isNaN(rating);
  const distanceNote =
    typeof distanceMiles === "number" && distanceMiles > 0
      ? formatDistanceMiles(distanceMiles)
      : null;

  return (
    <Link
      href={href}
      aria-label={`View profile for ${name}`}
      className={[
        "group/coach relative flex min-h-[331px] flex-col justify-end overflow-hidden rounded-[20px] p-4 sm:min-h-[377px]",
        "transition duration-300 ease-out hover:scale-[1.01] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2",
        className,
      ].join(" ")}
    >
      {avatarImage?.trim() ? (
        <img
          src={avatarImage.trim()}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover/coach:scale-[1.03]"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-dark" aria-hidden />
      )}
      <div
        className="absolute inset-0 bg-gradient-to-b from-[rgba(2,16,16,0)] via-[rgba(2,16,16,0.7)] via-[72%] to-[rgba(2,16,16,0.85)]"
        aria-hidden
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[179px] bg-gradient-to-b from-transparent via-[rgba(2,16,16,0.01)] to-[rgba(2,16,16,0.01)] backdrop-blur-[6.5px]"
        aria-hidden
      />

      {badgeLabel ? (
        <span className="absolute left-4 top-4 z-10 rounded-full bg-[#021010] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-surface">
          {badgeLabel}
        </span>
      ) : null}

      {showRating ? (
        <div className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-full bg-surface px-2 py-1 text-sm font-medium text-primary shadow-sm">
          <Star className="h-3.5 w-3.5 fill-primary text-primary" aria-hidden />
          <span>{formatRating(rating)}</span>
        </div>
      ) : null}

      <div className="relative z-10 flex flex-col gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-white">{name}</h3>
            {levelLabel ? (
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${levelBadgeClass(levelLabel)}`}
              >
                {levelLabel}
              </span>
            ) : null}
          </div>
          {locationLine ? (
            <p className="flex items-center gap-1 text-[15px] text-white">
              <MapPin className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              <span className="font-medium">{locationLine}</span>
              {distanceNote ? (
                <>
                  <span className="text-white/80">·</span>
                  <span className="text-[#d0d0d0]">{distanceNote}</span>
                </>
              ) : null}
            </p>
          ) : null}
          {focusLine ? (
            <p className="text-sm font-semibold text-accent">{focusLine}</p>
          ) : null}
        </div>

        <div className="flex items-end justify-between gap-3">
          {priceFrom?.trim() ? (
            <p className="text-[15px] text-[#ddd]">
              From <span className="text-base font-semibold text-white">{priceFrom.trim()}</span>
            </p>
          ) : (
            <span />
          )}
          <CardArrowButton />
        </div>
      </div>
    </Link>
  );
}

export default function CoachCard(props: CoachCardProps) {
  if (props.variant === "featured") {
    return <FeaturedCoachCard {...props} />;
  }
  return <ListingCoachCard {...props} />;
}