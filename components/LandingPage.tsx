import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, MapPin } from "lucide-react";
import type { Venue, WhereOption } from "../lib/venueFilters";
import VenueCard from "./VenueCard";
import HeroWhereSearch from "./HeroWhereSearch";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1622163642998-2d13d73993d1?auto=format&fit=crop&w=1920&q=85";

const WHY = [
  {
    title: "Curated venues",
    body: "Hand-picked clubs with reliable court quality and clear information—so you spend less time guessing.",
  },
  {
    title: "Coaching-first",
    body: "Spot coaching availability fast and choose venues that match how you want to train.",
  },
  {
    title: "High-quality courts",
    body: "Compare indoor and outdoor options, court counts, and ratings in one calm, scannable view.",
  },
] as const;

const DESTINATIONS = [
  { city: "Madrid", country: "Spain", image: "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=600&q=80" },
  { city: "Barcelona", country: "Spain", image: "https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=600&q=80" },
  { city: "Marbella", country: "Spain", image: "https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=600&q=80" },
  { city: "Valencia", country: "Spain", image: "https://images.unsplash.com/photo-1569003339405-ea396a5a8a90?auto=format&fit=crop&w=600&q=80" },
  { city: "Lisbon", country: "Portugal", image: "https://images.unsplash.com/photo-1585208798174-6cedd86e019a?auto=format&fit=crop&w=600&q=80" },
] as const;

type LandingPageProps = {
  featuredVenues: Venue[];
  whereOptions: WhereOption[];
};

export default function LandingPage({ featuredVenues, whereOptions }: LandingPageProps) {
  return (
    <div className="min-h-full bg-white">
      {/* Hero */}
      <section className="relative min-h-[min(88vh,780px)]">
        <Image
          src={HERO_IMAGE}
          alt=""
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/35 to-black/65" />
        <div className="relative mx-auto flex min-h-[min(88vh,780px)] max-w-5xl flex-col justify-center px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-20">
          <p className="mb-3 text-center text-sm font-semibold uppercase tracking-[0.2em] text-white/80">
            Train anywhere
          </p>
          <h1 className="mx-auto max-w-3xl text-center text-4xl font-semibold tracking-tight text-white drop-shadow-sm sm:text-5xl md:text-6xl">
            Find the best padel venues abroad
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-center text-lg text-white/90 sm:text-xl">
            Discover courts, coaching, and trusted clubs—built for players who care about quality sessions.
          </p>
          <div className="mt-10 sm:mt-12">
            <HeroWhereSearch whereOptions={whereOptions} />
          </div>
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mb-10 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Featured venues</h2>
            <p className="mt-1 text-slate-600">Top picks based on courts, coaching, and premium signals.</p>
          </div>
          <Link
            href="/venues"
            className="inline-flex items-center gap-1 text-sm font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 transition hover:decoration-slate-900"
          >
            View all
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {featuredVenues.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-slate-600">
            No venues yet—check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredVenues.map((v) => (
              <VenueCard key={v.id} venue={v} />
            ))}
          </div>
        )}
      </section>

      {/* Why */}
      <section className="border-y border-slate-100 bg-slate-50/80">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="mx-auto max-w-2xl text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Why players use Padel
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-slate-600">
            Less noise, faster decisions—so you can book with confidence.
          </p>
          <ul className="mt-12 grid gap-8 sm:grid-cols-3">
            {WHY.map((item) => (
              <li key={item.title} className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                <CheckCircle2 className="mb-4 h-8 w-8 text-slate-900" aria-hidden />
                <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Destinations */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Popular destinations</h2>
        <p className="mt-1 max-w-xl text-slate-600">Jump into cities players love—filters apply in one tap.</p>
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
          {DESTINATIONS.map((d) => (
            <Link
              key={`${d.city}-${d.country}`}
              href={`/venues?location=${encodeURIComponent(`${d.city}, ${d.country}`)}`}
              className="group relative aspect-[4/5] overflow-hidden rounded-2xl ring-1 ring-black/5 transition hover:ring-slate-900/10"
            >
              <Image
                src={d.image}
                alt=""
                fill
                className="object-cover transition duration-500 group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, 20vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="font-semibold text-white">{d.city}</p>
                <p className="text-xs text-white/80">{d.country}</p>
              </div>
              <MapPin className="absolute right-2 top-2 h-4 w-4 text-white/90 opacity-0 transition group-hover:opacity-100" aria-hidden />
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="overflow-hidden rounded-3xl bg-slate-900 px-6 py-12 text-center sm:px-12 sm:py-14">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Ready to find your next court?</h2>
          <p className="mx-auto mt-2 max-w-md text-slate-300">
            Browse every venue, refine by location and training needs, and compare at a glance.
          </p>
          <Link
            href="/venues"
            className="mt-8 inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            Explore all venues
          </Link>
        </div>
      </section>
    </div>
  );
}
