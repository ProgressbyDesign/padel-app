import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Quote } from "lucide-react";
import type { CoachSearchRow, VenueSearchRow } from "../lib/coaches";
import type { CoachListingItem } from "../lib/coachListing";
import { coachListingProfileHref } from "../lib/coachListing";
import CoachCard from "./CoachCard";
import type { WhereOption } from "../lib/venueFilters";
import HeroWhereSearch from "./HeroWhereSearch";
import HomeEnquiryCta from "./home/HomeEnquiryCta";
import HomeBentoGrid, { type BentoVenuePreview } from "./home/HomeBentoGrid";
import DestinationsCarousel from "./home/DestinationsCarousel";

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
  whereOptions: WhereOption[];
  coachSearchRows: CoachSearchRow[];
  venueSearchRows: VenueSearchRow[];
  recommendedCoach: CoachListingItem | null;
  recommendedVenue: BentoVenuePreview | null;
  enquiryVenueId: string | null;
  stats: HomeStats;
};

function formatStat(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

export default function LandingPage({
  featuredCoaches,
  whereOptions,
  coachSearchRows,
  venueSearchRows,
  recommendedCoach,
  recommendedVenue,
  enquiryVenueId,
  stats,
}: LandingPageProps) {
  return (
    <div className="min-h-full bg-surface">
      {/* Hero */}
      <section className="relative min-h-[min(88vh,780px)]">
        <Image
          src={HERO_IMAGE}
          alt=""
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/35 to-black/65" />
        <div className="relative mx-auto flex min-h-[min(88vh,780px)] max-w-6xl flex-col justify-center px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-20">
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
            <HeroWhereSearch
              whereOptions={whereOptions}
              coachSearchRows={coachSearchRows}
              venueSearchRows={venueSearchRows}
            />
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

      {/* Featured coaches */}
      <section className="border-b border-primary/10 bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl">Featured coaches</h2>
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

          {featuredCoaches.length === 0 ? (
            <p className="mt-10 rounded-2xl border border-dashed border-primary/20 bg-white px-6 py-12 text-center text-primary/70">
              No coaches listed yet—check back soon.
            </p>
          ) : (
            <div className="mt-10 -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible lg:grid-cols-3">
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
                  priceFrom={c.priceFrom}
                  href={coachListingProfileHref(c.id)}
                  className="min-w-[min(100%,320px)] shrink-0 sm:min-w-0"
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Destinations carousel */}
      <section id="destinations" className="scroll-mt-24 border-b border-primary/10 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl">Popular training destinations</h2>
          <p className="mt-1 max-w-xl text-sm text-primary/65">
            Tap a country to see coaches—we&apos;ll apply location on the listing.
          </p>
          <div className="mt-10">
            <DestinationsCarousel />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-primary/10 bg-dark">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-10">
            {[
              { label: "Coaches listed", value: formatStat(stats.coachesListed) },
              { label: "Countries covered", value: formatStat(stats.countriesCovered) },
              { label: "Locations available", value: formatStat(stats.locationsAvailable) },
              { label: "Enquiries completed", value: formatStat(stats.enquiriesCompleted) },
            ].map((item) => (
              <div key={item.label} className="text-center md:text-left">
                <p className="text-3xl font-semibold tabular-nums tracking-tight text-white sm:text-4xl md:text-5xl">
                  {item.value}
                </p>
                <p className="mt-2 text-xs font-medium uppercase tracking-wider text-white/55 sm:text-sm">{item.label}</p>
              </div>
            ))}
          </div>
          {stats.enquiriesCompleted == null ? (
            <p className="mt-8 text-center text-xs text-white/45 md:text-left">
              Enquiry total updates when available.
            </p>
          ) : null}
        </div>
      </section>

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

      {/* Final CTA */}
      <section className="bg-surface pb-16 pt-4 sm:pb-24 sm:pt-6">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <HomeEnquiryCta venueId={enquiryVenueId} />
        </div>
      </section>
    </div>
  );
}
