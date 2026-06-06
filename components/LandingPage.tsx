import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Quote } from "lucide-react";
import type { CoachListingItem } from "../lib/coachListing";
import { coachListingProfileHref } from "../lib/coachListing";
import CoachCard from "./CoachCard";
import type { Venue } from "../lib/venueFilters";
import { getVenueMainImageUrl } from "../lib/venueDetailHelpers";
import HomeStickySearch from "./search/HomeStickySearch";
import HomeEnquiryCta from "./home/HomeEnquiryCta";
import HomeBentoGrid, { type BentoVenuePreview } from "./home/HomeBentoGrid";
import HomeStatsBento from "./home/HomeStatsBento";
import HomeValuePromo from "./home/HomeValuePromo";
import InteractiveGlobeDestinations from "./sections/InteractiveGlobeDestinations";
import type { PadelCountry } from "../lib/padelCountries";
import VenueCard from "./VenueCard";
import Carousel from "./ui/Carousel";

const HERO_IMAGE = "/images/Depositphotos_850818406_XL.jpg";

const TESTIMONIALS = [
  {
    quote: "Finally found a coach who matched my level before I booked flights. The whole flow felt premium.",
    name: "Alex M.",
    location: "London, UK",
  },
  {
    quote: "We used Padel Pathways to shortlist academies in Spain—saved hours of DMs and guesswork.",
    name: "Sofia R.",
    location: "Madrid, Spain",
  },
  {
    quote: "Clear profiles and honest locations. Exactly what I wanted when planning a training week abroad.",
    name: "Jonas K.",
    location: "Stockholm, Sweden",
  },
] as const;

export type HomeStats = {
  coachesListed: number;
  countriesCovered: number;
  locationsAvailable: number;
  enquiriesCompleted: number | null;
};

type LandingPageProps = {
  featuredCoaches: CoachListingItem[];
  featuredVenues: Venue[];
  recommendedCoach: CoachListingItem | null;
  recommendedVenue: BentoVenuePreview | null;
  enquiryVenueId: string | null;
  stats: HomeStats;
  destinationCountries: PadelCountry[];
};

export default function LandingPage({
  featuredCoaches,
  featuredVenues,
  recommendedCoach,
  recommendedVenue,
  enquiryVenueId,
  stats,
  destinationCountries,
}: LandingPageProps) {
  return (
    <div className="min-h-full bg-surface">
      {/* Hero — full bleed under fixed transparent nav */}
      <section className="relative -mt-14 min-h-[min(88vh,780px)] sm:-mt-16">
        <Image
          src={HERO_IMAGE}
          alt=""
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/70" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-transparent" aria-hidden />
        <div className="relative mx-auto flex min-h-[min(88vh,780px)] max-w-6xl flex-col justify-center px-4 pb-20 pt-24 sm:px-6 sm:pb-24 sm:pt-28">
          <p className="mb-3 text-center text-sm font-semibold uppercase tracking-[0.2em] text-white/80">
            Train anywhere
          </p>
          <h1 className="mx-auto max-w-3xl text-center text-4xl font-semibold tracking-tight text-white drop-shadow-sm sm:text-5xl md:text-6xl">
            Find the Best Padel Coaching & Training Camps Worldwide
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-center text-lg text-white/90 sm:text-xl">
            Compare academies, book trips, and train like a pro
          </p>
          <div className="mt-10 sm:mt-12">
            <HomeStickySearch />
          </div>
        </div>
      </section>

      {/* Bento */}
      <section className="border-b border-primary/10 bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-sm font-semibold uppercase tracking-wider text-primary/50">Start here</h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-lg font-semibold text-primary">Choose your path</p>
        </div>
        <div className="mt-10">
          <HomeBentoGrid
            recommendedCoach={recommendedCoach}
            recommendedVenue={recommendedVenue}
            enquiryVenueId={enquiryVenueId}
          />
        </div>
      </section>

      {/* Top-rated coaches */}
      <section className="border-b border-primary/10 bg-surface py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl">Top-rated coaches</h2>
              <p className="mt-1 max-w-xl text-primary/70">
                Hand-picked from our directory—compare levels, locations, and coaching focus.
              </p>
            </div>
            <Link
              href="/coaches"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary underline decoration-primary/25 underline-offset-4 transition hover:decoration-primary"
            >
              View all coaches
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {featuredCoaches.length === 0 ? (
          <div className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
            <p className="rounded-2xl border border-dashed border-primary/20 bg-white px-6 py-12 text-center text-primary/70">
              No coaches listed yet—check back soon.
            </p>
          </div>
        ) : (
          <div className="mt-10">
            <Carousel variant="fullBleed" showPagination>
              {featuredCoaches.map((c) => (
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
                  outcomeTags={c.outcomeTags}
                  priceFrom={c.priceFrom}
                  href={coachListingProfileHref(c.id, "coaches")}
                  className="h-full w-full"
                />
              ))}
            </Carousel>
          </div>
        )}
      </section>

      {/* Player favourite courts */}
      <section className="border-b border-primary/10 bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl">Player favourite courts</h2>
              <p className="mt-1 max-w-xl text-primary/70">
                Venues players return to—courts, coaching, and locations worth the trip.
              </p>
            </div>
            <Link
              href="/venues"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary underline decoration-primary/25 underline-offset-4 transition hover:decoration-primary"
            >
              View all venues
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {featuredVenues.length === 0 ? (
          <div className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
            <p className="rounded-2xl border border-dashed border-primary/20 bg-surface px-6 py-12 text-center text-primary/70">
              No venues listed yet—check back soon.
            </p>
          </div>
        ) : (
          <div className="mt-10">
            <Carousel variant="fullBleed" showPagination>
              {featuredVenues.map((v) => (
                <VenueCard
                  key={String(v.id)}
                  venue={{
                    ...v,
                    image_url: getVenueMainImageUrl(v) ?? v.image_url ?? null,
                  }}
                />
              ))}
            </Carousel>
          </div>
        )}
      </section>

      <InteractiveGlobeDestinations countries={destinationCountries} />

      <HomeValuePromo />

      <HomeStatsBento stats={stats} />

      {/* Reviews */}
      <section className="border-b border-primary/10 bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <h2 className="text-center text-xl font-semibold tracking-tight text-primary sm:text-2xl">What players say</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <figure
                key={t.name}
                className="flex flex-col rounded-2xl border border-primary/10 bg-white p-6 shadow-sm"
              >
                <Quote className="h-8 w-8 text-secondary/80" aria-hidden />
                <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-primary/85">&ldquo;{t.quote}&rdquo;</blockquote>
                <figcaption className="mt-4 border-t border-primary/10 pt-4 text-sm">
                  <span className="font-semibold text-primary">{t.name}</span>
                  <span className="block text-xs text-primary/55">{t.location}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <HomeEnquiryCta venueId={enquiryVenueId} />
    </div>
  );
}
