"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Compass, MapPin, MessageSquarePlus } from "lucide-react";
import type { CoachListingItem } from "@/lib/coachListing";
import { coachListingProfileHref } from "@/lib/coachListing";
import EnquiryButton from "@/components/enquiry/EnquiryButton";

/** Minimal venue preview for the bento tile (same ranking as enquiry venue). */
export type BentoVenuePreview = {
  id: string;
  name: string;
  subtitle: string;
  imageUrl: string | null;
};

const GENERIC_COACH_BG =
  "https://images.unsplash.com/photo-1626228290616-844bc768965e?auto=format&fit=crop&w=1400&q=80";

const GENERIC_COACH_CARD =
  "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=800&q=80";

const GENERIC_VENUE_CARD =
  "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=800&q=80";

type HomeBentoGridProps = {
  recommendedCoach: CoachListingItem | null;
  recommendedVenue: BentoVenuePreview | null;
  enquiryVenueId: string | null;
};

function RecommendedBadge() {
  return (
    <span className="absolute left-3 top-3 z-10 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary shadow-md ring-1 ring-black/5 backdrop-blur-sm">
      Recommended
    </span>
  );
}

export default function HomeBentoGrid({ recommendedCoach, recommendedVenue, enquiryVenueId }: HomeBentoGridProps) {
  const coachHref = recommendedCoach ? coachListingProfileHref(recommendedCoach.id) : "/coaches";
  const coachImage =
    recommendedCoach?.avatarImage?.trim() || GENERIC_COACH_CARD;
  const coachLocation = [recommendedCoach?.locationCity, recommendedCoach?.locationCountry]
    .filter((x) => x?.trim())
    .join(", ");

  const venueHref = recommendedVenue ? `/venue/${encodeURIComponent(recommendedVenue.id)}` : "/venues";
  const venueImage = recommendedVenue?.imageUrl?.trim() || GENERIC_VENUE_CARD;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:gap-5">
        {/* 1 — Find a coach (large, generic coach imagery) */}
        <Link
          href="/coaches"
          className="group relative flex min-h-[260px] flex-col justify-end overflow-hidden rounded-3xl shadow-lg ring-1 ring-black/10 transition hover:shadow-xl sm:min-h-[300px] lg:col-span-6 lg:col-start-1 lg:row-span-3 lg:row-start-1 lg:min-h-[340px]"
        >
          <Image
            src={GENERIC_COACH_BG}
            alt=""
            fill
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
            sizes="(max-width:1024px) 100vw, 58vw"
            priority={false}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/25" aria-hidden />
          <div className="relative z-10 p-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/75">Discover</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Find a coach</h3>
            <p className="mt-2 max-w-md text-sm text-white/90">
              Browse profiles by location, level, and coaching focus—then book with confidence.
            </p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">
              Open directory
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
            </span>
          </div>
        </Link>

        {/* 2 & 3 — Get matched + Train abroad (stacked) */}
        <div className="flex flex-col gap-4 lg:col-span-6 lg:col-start-7 lg:row-span-2 lg:row-start-1 lg:flex lg:flex-col lg:justify-between lg:gap-4">
          <div className="flex min-h-[140px] flex-col justify-between rounded-3xl border border-primary/12 bg-white p-5 shadow-sm lg:flex-1">
            <div>
              <MessageSquarePlus className="h-7 w-7 text-secondary" aria-hidden />
              <h3 className="mt-3 text-lg font-semibold text-primary">Get matched</h3>
              <p className="mt-1 text-sm text-primary/65">Tell us your goals—we&apos;ll help narrow options.</p>
            </div>
            {enquiryVenueId ? (
              <EnquiryButton
                venueId={enquiryVenueId}
                label="Start enquiry"
                className="mt-4 w-full !rounded-xl py-2.5 text-sm"
              />
            ) : (
              <Link
                href="/venues"
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-primary/15 bg-surface py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/5"
              >
                Browse venues first
              </Link>
            )}
          </div>

          <Link
            href="#destinations"
            className="group flex min-h-[140px] flex-col justify-between rounded-3xl border border-primary/12 bg-gradient-to-br from-surface to-white p-5 shadow-sm transition hover:border-primary/25 hover:shadow-md lg:flex-1"
          >
            <Compass className="h-7 w-7 text-secondary" aria-hidden />
            <div>
              <h3 className="text-lg font-semibold text-primary">Train abroad</h3>
              <p className="mt-1 text-sm text-primary/65">Explore countries & cities players love.</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                View destinations
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
              </span>
            </div>
          </Link>
        </div>

        {/* 4 — Recommended coach (destination-style card) */}
        <Link
          href={coachHref}
          className="group relative aspect-[5/6] min-h-[200px] w-full overflow-hidden rounded-3xl ring-1 ring-black/5 transition hover:ring-primary/25 sm:aspect-[16/10] sm:min-h-[220px] lg:col-span-3 lg:col-start-7 lg:row-start-3 lg:aspect-[5/6] lg:min-h-[240px]"
        >
          <Image
            src={coachImage}
            alt=""
            fill
            className="object-cover transition duration-500 group-hover:scale-105"
            sizes="(max-width:1024px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" aria-hidden />
          <RecommendedBadge />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <p className="text-lg font-semibold text-white">
              {recommendedCoach?.name?.trim() || "Find a coach"}
            </p>
            {coachLocation ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-white/85">
                <MapPin className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                {coachLocation}
              </p>
            ) : (
              <p className="mt-1 text-xs text-white/80">Browse the directory</p>
            )}
            {recommendedCoach?.level ? (
              <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-white/75">{recommendedCoach.level}</p>
            ) : null}
          </div>
        </Link>

        {/* 5 — Recommended venue (destination-style card) */}
        <Link
          href={venueHref}
          className="group relative aspect-[5/6] min-h-[200px] w-full overflow-hidden rounded-3xl ring-1 ring-black/5 transition hover:ring-primary/25 sm:aspect-[16/10] sm:min-h-[220px] lg:col-span-3 lg:col-start-10 lg:row-start-3 lg:aspect-[5/6] lg:min-h-[240px]"
        >
          <Image
            src={venueImage}
            alt=""
            fill
            className="object-cover transition duration-500 group-hover:scale-105"
            sizes="(max-width:1024px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" aria-hidden />
          <RecommendedBadge />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <p className="text-lg font-semibold text-white">{recommendedVenue?.name?.trim() || "Explore venues"}</p>
            {recommendedVenue?.subtitle ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-white/85">
                <MapPin className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                {recommendedVenue.subtitle}
              </p>
            ) : (
              <p className="mt-1 text-xs text-white/80">Courts & coaching worldwide</p>
            )}
          </div>
        </Link>
      </div>
    </div>
  );
}
