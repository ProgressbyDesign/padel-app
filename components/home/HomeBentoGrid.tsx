"use client";

import Link from "next/link";
import { ArrowRight, Compass, MessageSquarePlus, Sparkles } from "lucide-react";
import type { CoachListingItem } from "@/lib/coachListing";
import { coachListingProfileHref } from "@/lib/coachListing";
import CoachCard from "@/components/CoachCard";
import EnquiryButton from "@/components/enquiry/EnquiryButton";

type HomeBentoGridProps = {
  recommendedCoaches: CoachListingItem[];
  enquiryVenueId: string | null;
};

export default function HomeBentoGrid({ recommendedCoaches, enquiryVenueId }: HomeBentoGridProps) {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2 lg:gap-5">
        {/* 1 — Find a Coach (large) */}
        <Link
          href="/coaches"
          className="group relative flex min-h-[280px] flex-col justify-end overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-dark p-6 text-white shadow-lg ring-1 ring-white/10 transition hover:shadow-xl md:min-h-[300px] lg:col-span-2 lg:row-span-2 lg:min-h-[340px]"
        >
          <Sparkles className="absolute right-5 top-5 h-8 w-8 text-white/40 transition group-hover:text-white/70" aria-hidden />
          <div className="relative z-10">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/75">Discover</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Find a coach</h3>
            <p className="mt-2 max-w-sm text-sm text-white/85">
              Browse profiles by location, level, and coaching focus—then book with confidence.
            </p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">
              Open directory
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
            </span>
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_50%)]" aria-hidden />
        </Link>

        {/* 2 — Get Matched */}
        <div className="flex min-h-[140px] flex-col justify-between rounded-3xl border border-primary/12 bg-white p-5 shadow-sm lg:col-start-3 lg:row-start-1">
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

        {/* 3 — Train Abroad */}
        <Link
          href="#destinations"
          className="group flex min-h-[140px] flex-col justify-between rounded-3xl border border-primary/12 bg-gradient-to-br from-surface to-white p-5 shadow-sm transition hover:border-primary/25 hover:shadow-md lg:col-start-4 lg:row-start-1"
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

        {/* 4 — Recommended coaches */}
        <div className="rounded-3xl border border-primary/12 bg-white p-4 shadow-sm lg:col-span-2 lg:col-start-3 lg:row-start-2">
          <div className="mb-3 flex items-center justify-between gap-2 px-1">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-primary/55">Recommended</h3>
            <Link href="/coaches" className="text-xs font-semibold text-primary underline-offset-4 hover:underline">
              View all
            </Link>
          </div>
          {recommendedCoaches.length === 0 ? (
            <p className="rounded-xl bg-surface px-4 py-8 text-center text-sm text-primary/60">Coaches coming soon.</p>
          ) : (
            <div className="-mx-2 flex gap-3 overflow-x-auto pb-1 pt-1 [-webkit-overflow-scrolling:touch]">
              {recommendedCoaches.slice(0, 3).map((c) => (
                <CoachCard
                  key={c.id}
                  name={c.name}
                  avatarImage={c.avatarImage}
                  rating={c.rating}
                  reviewCount={c.reviewCount}
                  level={c.level}
                  locationCity={c.locationCity}
                  locationCountry={c.locationCountry}
                  experienceYears={c.experienceYears}
                  audience={c.audience}
                  travelAvailable={c.travelAvailable}
                  outcomes={c.outcomes}
                  priceFrom={c.priceFrom}
                  href={coachListingProfileHref(c.id)}
                  className="min-w-[min(100%,260px)] max-w-[280px] shrink-0 scale-[0.92] sm:scale-95"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
