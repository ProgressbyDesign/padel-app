"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { CoachListingItem } from "@/lib/coachListing";
import { coachListingProfileHref } from "@/lib/coachListing";
import EnquiryModal from "@/components/enquiry/EnquiryModal";
import CoachCard from "@/components/CoachCard";
import HomeFeaturedVenueCard from "@/components/home/HomeFeaturedVenueCard";
import CardArrowButton from "@/components/home/CardArrowButton";

export type BentoVenuePreview = {
  id: string;
  name: string;
  subtitle: string;
  city?: string | null;
  country?: string | null;
  imageUrl: string | null;
  rating?: number | string | null;
  courts?: number | null;
  coachingAvailable?: boolean | null;
  courtType?: string | null;
};

const BENTO_COACH_CUTOUT = "/images/bento-coach-cutout.jpg";

type HomeBentoGridProps = {
  recommendedCoach: CoachListingItem | null;
  recommendedVenue: BentoVenuePreview | null;
  enquiryVenueId: string | null;
};

function FindCoachButton() {
  return (
    <span className="relative inline-flex h-11 items-center">
      <span className="inline-flex h-11 items-center rounded-full bg-[#031322] pl-4 pr-14 text-sm font-medium text-accent">
        Find your coach
      </span>
      <span className="absolute right-1 top-1/2 -translate-y-1/2">
        <CardArrowButton accent="lime" />
      </span>
    </span>
  );
}

export default function HomeBentoGrid({
  recommendedCoach,
  recommendedVenue,
  enquiryVenueId,
}: HomeBentoGridProps) {
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const coachHref = recommendedCoach ? coachListingProfileHref(recommendedCoach.id) : "/coaches";

  return (
    <>
      <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <Link
              href="/coaches"
              className="group relative flex min-h-[420px] overflow-hidden rounded-[20px] bg-accent sm:min-h-[440px] lg:min-h-[520px]"
            >
              <div className="relative z-10 flex max-w-md flex-col justify-center p-8 sm:p-[52px]">
                <p className="text-2xl font-bold uppercase tracking-tight text-primary/50">
                  Discover your
                </p>
                <h3 className="mt-1 max-w-sm font-heading text-3xl font-bold uppercase leading-none text-primary sm:text-4xl lg:text-[48px] lg:leading-[49px]">
                  Padel Pathways Certified Coach
                </h3>
                <p className="mt-3 max-w-sm text-lg text-primary">
                  Browse profiles by location, level, and coaching focus—then book with confidence.
                </p>
                <span className="mt-8 inline-flex">
                  <FindCoachButton />
                </span>
              </div>
              <div className="pointer-events-none absolute bottom-0 right-0 top-0 w-[55%] min-w-[220px] max-w-[540px]">
                <Image
                  src={BENTO_COACH_CUTOUT}
                  alt=""
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 1024px) 50vw, 540px"
                />
              </div>
            </Link>

            <div className="grid gap-6 sm:grid-cols-2 h-full">
              <Link
                href="/venues"
                className="group flex min-h-[172px] flex-col justify-center rounded-[20px] bg-[#aed4e8] px-8 py-7 transition hover:brightness-[0.98]"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-heading text-2xl font-bold uppercase leading-tight text-primary">
                      Explore training camps
                    </h3>
                    <p className="mt-2 text-lg text-primary">
                      Explore countries &amp; cities players love.
                    </p>
                  </div>
                  <CardArrowButton accent="dark" className="h-11 w-11 shrink-0" />
                </div>
              </Link>

              <button
                type="button"
                onClick={() => setEnquiryOpen(true)}
                className="group flex min-h-[172px] flex-col justify-center rounded-[20px] bg-[#171c1c] px-8 py-7 text-left transition hover:bg-[#1f2626]"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-heading text-2xl font-bold uppercase leading-tight text-accent">
                      Get matched
                    </h3>
                    <p className="mt-2 text-lg text-[#f0f1f7]">
                      Answer a few questions to help find the right coach for you.
                    </p>
                  </div>
                  <CardArrowButton accent="lime" className="h-11 w-11 shrink-0" />
                </div>
              </button>
            </div>
          </div>

          <div className="flex sm:min-w-[376px] flex-col gap-6 !aspect-3/2 lg:shrink-0">
            {recommendedCoach ? (
              <CoachCard
                variant="featured"
                badgeLabel="Top choice"
                name={recommendedCoach.name}
                avatarImage={recommendedCoach.avatarImage}
                rating={recommendedCoach.rating}
                level={recommendedCoach.level}
                locationCity={recommendedCoach.locationCity}
                locationCountry={recommendedCoach.locationCountry}
                outcomeTags={recommendedCoach.outcomeTags}
                primaryOutcome={recommendedCoach.primaryOutcome}
                priceFrom={recommendedCoach.priceFrom}
                href={coachHref}
                distanceMiles={recommendedCoach.distance}
                className="flex-1"
              />
            ) : (
              <Link
                href="/coaches"
                className="flex min-h-[331px] flex-1 items-end rounded-[20px] bg-primary/10 p-6"
              >
                <p className="text-lg font-semibold text-primary">Browse coaches</p>
              </Link>
            )}

            {recommendedVenue ? (
              <HomeFeaturedVenueCard
                id={recommendedVenue.id}
                name={recommendedVenue.name}
                city={recommendedVenue.city}
                country={recommendedVenue.country}
                imageUrl={recommendedVenue.imageUrl}
                rating={recommendedVenue.rating}
                courts={recommendedVenue.courts}
                coachingAvailable={recommendedVenue.coachingAvailable}
                courtType={recommendedVenue.courtType}
                className="min-h-[331px] flex-1"
              />
            ) : (
              <Link
                href="/venues"
                className="flex min-h-[331px] flex-1 items-end rounded-[20px] bg-primary/10 p-6"
              >
                <p className="text-lg font-semibold text-primary">Explore venues</p>
              </Link>
            )}
          </div>
        </div>
      </div>

      <EnquiryModal
        open={enquiryOpen}
        onClose={() => setEnquiryOpen(false)}
        venueId={enquiryVenueId ?? undefined}
      />
    </>
  );
}
