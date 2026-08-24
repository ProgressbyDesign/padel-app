import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Compass, Target, UserRound } from "lucide-react";

const COACH_IMAGE = "/images/bento-coach-cutout.jpg";
const HERO_IMAGE = "/images/hero-padel-overlay.jpg";

export default function PlayerBenefitsBento() {
  return (
    <section className="bg-white py-14 sm:py-20" aria-labelledby="player-benefits-heading">
      <div className="mx-auto max-w-[1366px] px-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/45">
          Why join
        </p>
        <h2
          id="player-benefits-heading"
          className="mt-3 max-w-2xl font-heading text-3xl font-bold tracking-tight text-primary sm:text-4xl"
        >
          A player account that keeps your padel journey together.
        </h2>
        <p className="mt-3 max-w-xl text-base leading-7 text-primary/65 sm:text-lg">
          Search coaches, discover where to train, and keep bookings connected to
          your account as you improve.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6 lg:grid-rows-2">
          <article className="relative min-h-[280px] overflow-hidden rounded-[24px] bg-accent lg:col-span-4 lg:row-span-2 lg:min-h-[460px]">
            <Image
              src={COACH_IMAGE}
              alt=""
              fill
              className="object-cover object-[70%_top] opacity-90"
              sizes="(max-width: 1024px) 100vw, 66vw"
            />
            <div
              className="absolute inset-0 bg-gradient-to-r from-accent via-accent/80 to-transparent"
              aria-hidden
            />
            <div className="relative z-10 flex h-full max-w-md flex-col justify-end p-7 sm:p-10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/55">
                Find the right coach
              </p>
              <h3 className="mt-2 font-heading text-3xl font-bold uppercase leading-none text-primary sm:text-4xl">
                Coaching that fits your goals
              </h3>
              <p className="mt-3 text-base leading-6 text-primary/80">
                Search by location, level and coaching focus — then enquire from a
                profile you can trust.
              </p>
            </div>
          </article>

          <article className="flex min-h-[200px] flex-col justify-between rounded-[24px] bg-secondary p-7 lg:col-span-2">
            <Compass className="h-8 w-8 text-primary" aria-hidden />
            <div>
              <h3 className="font-heading text-2xl font-bold uppercase leading-tight text-primary">
                Train wherever you play
              </h3>
              <p className="mt-2 text-sm leading-6 text-primary/75">
                Discover coaches and training at home or while you travel.
              </p>
            </div>
          </article>

          <article className="flex min-h-[200px] flex-col justify-between rounded-[24px] bg-card p-7 text-white lg:col-span-2">
            <CalendarDays className="h-8 w-8 text-accent" aria-hidden />
            <div>
              <h3 className="font-heading text-2xl font-bold uppercase leading-tight text-accent">
                Your bookings
              </h3>
              <p className="mt-2 text-sm leading-6 text-white/75">
                Keep coaching requests connected to your player account.
              </p>
            </div>
          </article>

          <article className="flex min-h-[180px] flex-col justify-between rounded-[24px] border border-primary/10 bg-surface p-7 lg:col-span-2">
            <UserRound className="h-8 w-8 text-primary" aria-hidden />
            <div>
              <h3 className="font-heading text-xl font-bold uppercase leading-tight text-primary">
                Your player account
              </h3>
              <p className="mt-2 text-sm leading-6 text-primary/70">
                One free account for your personal Padel Pathways journey.
              </p>
            </div>
          </article>

          <Link
            href="/venues"
            className="relative min-h-[200px] overflow-hidden rounded-[24px] lg:col-span-2"
          >
            <Image
              src={HERO_IMAGE}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 33vw"
            />
            <div className="absolute inset-0 bg-primary/55" aria-hidden />
            <div className="relative z-10 flex h-full flex-col justify-end p-7">
              <h3 className="font-heading text-xl font-bold uppercase leading-tight text-white">
                Discover venues
              </h3>
              <p className="mt-2 text-sm leading-6 text-white/80">
                Explore places to train alongside coach discovery.
              </p>
            </div>
          </Link>

          <article className="flex min-h-[180px] flex-col justify-center rounded-[24px] bg-accent-soft p-7 lg:col-span-2">
            <Target className="h-8 w-8 text-primary" aria-hidden />
            <h3 className="mt-4 font-heading text-xl font-bold uppercase leading-tight text-primary">
              Built around your goals
            </h3>
            <p className="mt-2 text-sm leading-6 text-primary/75">
              Padel Pathways is here for player development — not directory
              membership.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
