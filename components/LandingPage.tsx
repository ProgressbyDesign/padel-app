import Image from "next/image";
import Link from "next/link";
import type { CoachListingItem } from "../lib/coachListing";
import { coachListingProfileHref } from "../lib/coachListing";
import CoachCard from "./CoachCard";
import type { Venue } from "../lib/venueFilters";
import { getVenueMainImageUrl } from "../lib/venueDetailHelpers";
import HomeStickySearch from "./search/HomeStickySearch";
import HomeEnquiryCta from "./home/HomeEnquiryCta";
import HomeBentoGrid, { type BentoVenuePreview } from "./home/HomeBentoGrid";
import HomeMilestones from "./home/HomeMilestones";
import HomeValuePromo from "./home/HomeValuePromo";
import HomeTestimonials, { type HomeTestimonial } from "./home/HomeTestimonials";
import InteractiveGlobeDestinations from "./sections/InteractiveGlobeDestinations";
import type { PadelCountry } from "../lib/padelCountries";
import VenueCard from "./VenueCard";
import Carousel from "./ui/Carousel";

const HERO_IMAGE = "/images/hero-padel-overlay.jpg";

const TESTIMONIALS: HomeTestimonial[] = [
  {
    quote:
      "I found a coach who matched my level before I booked. The whole process felt clear, fast and premium.",
    name: "Alex M.",
    location: "London, UK",
    image: "/images/testimonial-1.jpg",
  },
  {
    quote:
      "We used Padel Pathways to shortlist academies in Spain—saved hours of DMs and guesswork.",
    name: "Sofia R.",
    location: "Madrid, Spain",
    image: "/images/testimonial-2.jpg",
  },
  {
    quote:
      "Clear profiles and honest locations. Exactly what I wanted when planning a training week abroad.",
    name: "Jonas K.",
    location: "Stockholm, Sweden",
    image: "/images/testimonial-3.jpg",
  },
];

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
      <section className="relative -mt-16 min-h-[min(88vh,815px)]">
        <Image
          src={HERO_IMAGE}
          alt=""
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(119.61deg, rgba(0, 36, 54, 0.8) 39.53%, rgba(0, 36, 54, 0.3) 76.64%)",
          }}
          aria-hidden
        />
        <div className="relative mx-auto flex min-h-[min(88vh,815px)] max-w-[1680px] flex-col justify-center px-4 pb-20 pt-28 sm:px-6 sm:pb-24">
          <p className="mb-2 text-center text-2xl font-bold uppercase tracking-tight text-white/90 sm:text-[32px]">
            Find the Best
          </p>
          <h1 className="mx-auto max-w-4xl text-center font-heading text-4xl font-bold uppercase leading-[1.05] tracking-tight text-white drop-shadow-sm sm:text-5xl md:text-6xl lg:text-[64px] lg:leading-[64px]">
            Padel Coaching &amp; Training Camps Worldwide
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-center text-lg text-white/90 sm:text-xl">
            Compare coaches, venues and training camps, then book with confidence.
          </p>
          <div className="mt-10 sm:mt-12">
            <HomeStickySearch />
          </div>
        </div>
      </section>

      <section className="border-b border-primary/10 bg-white py-14 sm:py-24">
        <div className="mx-auto max-w-[1680px] px-4 sm:px-6 ">
          <h2 className="text-center font-heading text-3xl font-bold uppercase tracking-tight text-primary sm:text-4xl">
            Choose your path
          </h2>
        </div>
        <div className="mt-10 sm:mt-12">
          <HomeBentoGrid
            recommendedCoach={recommendedCoach}
            recommendedVenue={recommendedVenue}
            enquiryVenueId={enquiryVenueId}
          />
        </div>
      </section>

      <section className="border-b border-primary/10 bg-surface py-14 sm:py-24">
        <div className="mx-auto max-w-[1680px] px-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-primary sm:text-4xl">
                Top-rated coaches
              </h2>
              <p className="mt-2 text-lg text-primary/70">
                Hand-picked from our directory—compare levels, locations, and coaching focus.
              </p>
            </div>
            <Link
              href="/coaches"
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-accent transition hover:bg-primary/90"
            >
              View all coaches
            </Link>
          </div>
        </div>

        {featuredCoaches.length === 0 ? (
          <div className="mx-auto mt-10 max-w-[1680px] px-4 sm:px-6">
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
                  variant="featured"
                  badgeLabel="Best choice"
                  name={c.name}
                  avatarImage={c.avatarImage}
                  rating={c.rating}
                  level={c.level}
                  locationCity={c.locationCity}
                  locationCountry={c.locationCountry}
                  outcomeTags={c.outcomeTags}
                  primaryOutcome={c.primaryOutcome}
                  priceFrom={c.priceFrom}
                  href={coachListingProfileHref(c.id, "coaches")}
                  distanceMiles={c.distance}
                  className="h-full w-full"
                />
              ))}
            </Carousel>
          </div>
        )}
      </section>

      <HomeValuePromo />

      <section className="border-b border-primary/10 bg-white py-14 sm:py-24">
        <div className="mx-auto max-w-[1680px] px-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-primary sm:text-4xl">
                Player favourite courts
              </h2>
              <p className="mt-2 text-lg text-primary/70">
                Venues players return to—courts, coaching, and locations worth the trip.
              </p>
            </div>
            <Link
              href="/venues"
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-accent transition hover:bg-primary/90"
            >
              View all venues
            </Link>
          </div>
        </div>

        {featuredVenues.length === 0 ? (
          <div className="mx-auto mt-10 max-w-[1680px] px-4 sm:px-6">
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
                  badgeLabel="Best choice"
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

      <HomeMilestones stats={stats} />

      <InteractiveGlobeDestinations countries={destinationCountries} />

      <HomeTestimonials items={TESTIMONIALS} />

      <HomeEnquiryCta venueId={enquiryVenueId} />
    </div>
  );
}
