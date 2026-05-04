import Link from "next/link";
import {
  Briefcase,
  Car,
  MapPin,
  Star,
  Users,
} from "lucide-react";
import type { CoachSkillLevel } from "../lib/coaches";

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
  /** Single headline: pass the first structured outcome (or a short fallback line). */
  outcomes?: string | null;
  priceFrom?: string | null;
  /** Profile destination — entire card is a single interactive region */
  href: string;
  className?: string;
};

function formatRating(rating: number): string {
  if (Number.isInteger(rating)) return String(rating);
  return rating.toFixed(1);
}

function formatExperienceYears(years: number): string {
  if (years < 1) return "<1 yr";
  if (years === 1) return "1 yr";
  return `${years} yrs`;
}

function levelBadgeClass(level: string): string {
  const key = level.toLowerCase();
  if (key === "beginner") return "bg-primary text-white ring-white/20";
  if (key === "intermediate") return "bg-secondary/35 text-primary ring-secondary/40";
  if (key === "advanced") return "bg-dark text-white ring-white/20";
  if (key === "pro") return "bg-dark text-accent ring-accent/30";
  return "bg-primary/90 text-white ring-white/15";
}

export default function CoachCard({
  name,
  avatarImage,
  rating,
  reviewCount,
  level,
  locationCity,
  locationCountry,
  experienceYears,
  audience,
  travelAvailable,
  outcomes,
  priceFrom,
  href,
  className = "",
}: CoachCardProps) {
  const locationLine = [locationCity, locationCountry].filter((x) => x?.trim()).join(", ");
  const levelLabel = level?.trim();
  const audienceClean = (audience ?? []).map((a) => a.trim()).filter(Boolean);
  const outcomesText = outcomes?.trim() ?? null;
  const showRating = typeof rating === "number" && !Number.isNaN(rating);
  const showMeta =
    (typeof experienceYears === "number" && !Number.isNaN(experienceYears)) ||
    audienceClean.length > 0 ||
    Boolean(travelAvailable);
  const reviewNote =
    typeof reviewCount === "number" && reviewCount > 0 ? `(${reviewCount.toLocaleString()})` : null;
  const ariaLabel = `View profile for ${name}`;

  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={[
        "group/coach block cursor-pointer rounded-2xl bg-white p-4 shadow-[0_2px_12px_rgba(0,60,60,0.08)] ring-1 ring-primary/12",
        "transition duration-300 ease-out",
        "hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_12px_32px_rgba(0,60,60,0.12)] hover:ring-primary/20",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2",
        className,
      ].join(" ")}
    >
      <article className="flex flex-col">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-gradient-to-br from-surface to-primary/8">
          {avatarImage?.trim() ? (
            <img
              src={avatarImage.trim()}
              alt={`${name}, padel coach`}
              className="absolute inset-0 h-full w-full object-cover transition duration-500 ease-out group-hover/coach:scale-[1.03]"
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

          {levelLabel ? (
            <div className="absolute left-2.5 top-2.5 z-10">
              <span
                className={[
                  "inline-flex max-w-[min(100%,12rem)] truncate rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 backdrop-blur-sm",
                  levelBadgeClass(levelLabel),
                ].join(" ")}
              >
                {levelLabel}
              </span>
            </div>
          ) : null}

          {showRating ? (
            <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-sm font-semibold text-primary shadow-sm ring-1 ring-black/5 backdrop-blur-sm">
              <Star className="h-3.5 w-3.5 fill-secondary text-secondary" aria-hidden />
              <span>{formatRating(rating)}</span>
              {reviewNote ? (
                <span className="text-xs font-normal text-primary/60">{reviewNote}</span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex min-w-0 flex-col gap-3">
          <header className="min-w-0 space-y-1">
            <h3 className="text-lg font-bold leading-snug tracking-tight text-primary">{name}</h3>
            {locationLine ? (
              <p className="flex items-start gap-1.5 text-sm text-primary/70">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-secondary" aria-hidden />
                <span>{locationLine}</span>
              </p>
            ) : null}
          </header>

          {outcomesText ? (
            <p
              className="line-clamp-1 text-sm font-medium leading-snug text-primary/75"
              title={outcomesText}
            >
              {outcomesText}
            </p>
          ) : null}

          {showMeta ? (
            <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-primary/10 pt-3 text-xs text-primary/70">
              {typeof experienceYears === "number" && !Number.isNaN(experienceYears) ? (
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5 shrink-0 text-secondary" aria-hidden />
                  <span className="font-medium text-primary">{formatExperienceYears(experienceYears)}</span>
                </span>
              ) : null}
              {audienceClean.length > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 shrink-0 text-secondary" aria-hidden />
                  <span className="font-medium text-primary">{audienceClean.join(" / ")}</span>
                </span>
              ) : null}
              {travelAvailable ? (
                <span className="inline-flex items-center gap-1.5">
                  <Car className="h-3.5 w-3.5 shrink-0 text-secondary" aria-hidden />
                  <span className="font-medium text-primary">Travels</span>
                </span>
              ) : null}
            </div>
          ) : null}

          {priceFrom?.trim() ? (
            <p className="text-sm font-semibold text-primary">{priceFrom.trim()}</p>
          ) : null}

          <div className="flex pt-1 sm:justify-end">
            <span className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition group-hover/coach:bg-primary/90 sm:w-auto">
              View Profile
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
