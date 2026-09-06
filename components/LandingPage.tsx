import Link from "next/link";
import type { CoachListingItem } from "../lib/coachListing";
import { coachListingProfileHref } from "../lib/coachListing";
import CoachCard from "./CoachCard";
import type { Venue } from "../lib/venueFilters";
import { getVenueMainImageUrl } from "../lib/venueDetailHelpers";
import HomeEnquiryCta from "./home/HomeEnquiryCta";
import HomeBentoGrid, { type BentoVenuePreview } from "./home/HomeBentoGrid";
import HomeHero from "./home/HomeHero";
import HomeMilestones from "./home/HomeMilestones";
import HomeValuePromo from "./home/HomeValuePromo";
import HomeTestimonials, { type HomeTestimonial } from "./home/HomeTestimonials";
import InteractiveGlobeDestinations from "./sections/InteractiveGlobeDestinations";
import type { PadelCountry } from "../lib/padelCountries";
import type { HomeStats } from "../lib/queries/homeStats";
import VenueCard from "./VenueCard";
import Carousel from "./ui/Carousel";

export type { HomeStats };

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

type LandingPageProps = {
  featuredCoaches: CoachListingItem[];
  featuredVenues: Venue[];
  recommendedCoach: CoachListingItem | null;
  recommendedVenue: BentoVenuePreview | null;
  enquiryVenueId: string | null;
  stats: HomeStats;
  destinationCountries: PadelCountry[];
  coachRegisterHref: string;
  venueRegisterHref: string;
};

export default function LandingPage({
  featuredCoaches,
  featuredVenues,
  recommendedCoach,
  recommendedVenue,
  enquiryVenueId,
  stats,
  destinationCountries,
  coachRegisterHref,
  venueRegisterHref,
}: LandingPageProps) {
  return (
    <div className="min-h-full bg-surface">
      <HomeHero />

      <section className="border-b border-primary/10 bg-white py-14 sm:py-24">
        <div className="mx-auto max-w-[1680px] px-4 sm:px-6 ">
          <h2 className="text-center">
            Choose your path
          </h2>
        </div>
        <div className="mt-10 sm:mt-12">
          <HomeBentoGrid
            recommendedCoach={recommendedCoach}
            recommendedVenue={recommendedVenue}
            enquiryVenueId={enquiryVenueId}
            coachRegisterHref={coachRegisterHref}
            venueRegisterHref={venueRegisterHref}
          />
        </div>
      </section>

      <section className="border-b border-primary/10 bg-surface py-14 sm:py-24">
        <div className="mx-auto max-w-[1680px] px-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <h2>
                Top-rated coaches
              </h2>
              <p className="mt-2 text-lg text-primary/70">
                Hand-picked from all over the world — compare levels, locations and coaching
                specialism.
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
              <h2>
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
