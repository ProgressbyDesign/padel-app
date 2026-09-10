import Link from "next/link";
import { Suspense } from "react";
import { ArrowDown, ArrowLeft, ArrowUpRight, Check, MapPin, ShieldCheck, Star } from "lucide-react";
import type { CoachProfileView } from "../lib/coachProfileView";
import type { PublicVenue } from "../lib/venueFilters";
import type { PublicVenueAvailabilityGroup } from "../lib/coachAvailability/types";
import { formatInTimeZone } from "../lib/coachAvailability/timezone";
import { PAYMENT_COPY } from "../lib/coachBookings/constants";
import VenueCardsWithDistance from "./VenueCardsWithDistance";
import CoachProfileBack from "./CoachProfileBack";
import CoachImage from "./CoachImage";
import CoachReviewsSection from "./CoachReviewsSection";
import type { CoachReviewsData } from "../lib/coachReviews";
import CoachPublicAvailabilitySection from "./CoachPublicAvailabilitySection";

type CoachProfilePageProps = {
  coach: CoachProfileView;
  venues: PublicVenue[];
  availabilityGroups?: PublicVenueAvailabilityGroup[];
  reviewsData: CoachReviewsData;
};

const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary";

export default function CoachProfilePage({ coach, venues, availabilityGroups = [], reviewsData }: CoachProfilePageProps) {
  const displayName = coach.name?.trim() || "Coach";
  const levels = coach.playerLevels.length ? coach.playerLevels : coach.level?.trim() ? [coach.level.trim()] : [];
  const locations = coach.locations.length ? coach.locations : coach.location.full?.trim() ? [coach.location] : [];
  const gallery = coach.gallery.slice(1);
  const hasReviews = (coach.rating.count ?? 0) > 0 && coach.rating.score != null && Number.isFinite(coach.rating.score) && coach.rating.score > 0;
  const badges = coach.badges.filter((badge) => badge.id === "verified" || badge.id === "venue_confirmed");
  const nextSlot = availabilityGroups.flatMap((group) => group.days.flatMap((day) => day.slots)).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const hasSessions = Boolean(nextSlot);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 text-primary sm:px-6 sm:py-8 lg:px-8">
      <Suspense fallback={<Link href="/coaches" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-primary/70"><ArrowLeft className="h-4 w-4" aria-hidden />Back to coaches</Link>}>
        <CoachProfileBack />
      </Suspense>

      <header className="overflow-hidden rounded-[28px] bg-primary text-white">
        <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-5 p-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-7 sm:p-8 xl:grid-cols-[240px_minmax(0,1fr)_300px] xl:gap-8">
          <div className="self-start sm:self-stretch">
            <CoachImage src={coach.image} alt={`${displayName}, padel coach`} loading="eager" className="aspect-[3/4] w-full rounded-2xl object-cover object-[center_20%] sm:h-full sm:max-h-[340px]" />
          </div>
          <div className="min-w-0 self-center py-1 sm:py-4">
            <p className="mb-3 hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-accent sm:block sm:text-xs">Your next chapter on court</p>
            <h1 className="break-words text-2xl leading-tight text-white sm:text-4xl xl:text-5xl">{displayName}</h1>
            {coach.role?.trim() ? <p className="mt-2 text-sm text-white/80 sm:text-lg">{coach.role.trim()}</p> : null}
            {coach.location.full?.trim() ? <p className="mt-3 flex items-start gap-2 text-sm text-white/80 sm:mt-4"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden /><span>{coach.location.full}</span></p> : null}
            {badges.length ? <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 sm:mt-5" aria-label="Coach credentials">{badges.map((badge) => <li key={badge.id} className="flex items-center gap-1.5 text-xs font-medium text-white/90"><ShieldCheck className="h-4 w-4 shrink-0 text-accent" aria-hidden />{badge.label}</li>)}</ul> : null}
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/20 pt-3 sm:mt-5 sm:pt-5 text-xs text-white/80 sm:text-sm">
              {coach.experience?.trim() ? <p><span className="font-semibold text-white">{coach.experience}</span> experience</p> : null}
              {hasReviews ? <a href="#coach-reviews" className="flex min-h-11 items-center gap-1.5 underline underline-offset-4"><Star className="h-4 w-4 fill-accent text-accent" aria-hidden /><span>{coach.rating.score!.toFixed(1)} · {coach.rating.count} reviews</span></a> : <a href="#coach-reviews" className="inline-flex min-h-11 items-center text-white/80 underline underline-offset-4">No verified reviews yet</a>}
              {coach.travel ? <p>Travels to coach</p> : null}
            </div>
          </div>

          <aside aria-label="Coaching session summary" className="col-span-2 flex flex-col rounded-2xl bg-white p-5 text-primary sm:p-6 xl:col-span-1">
            <p className="hidden text-xs font-semibold uppercase tracking-[0.16em] text-primary/65 sm:block">Make time for your game</p>
            <h2 className="text-xl sm:mt-3 sm:text-2xl">Train with {displayName}</h2>
            {coach.pricing.displayFrom?.trim() ? <p className="mt-3 text-lg font-semibold">{coach.pricing.displayFrom.trim()}</p> : null}
            {nextSlot ? <div className="my-4 border-y border-primary/10 py-3 sm:my-5 sm:py-4"><p className="flex items-center gap-2 text-xs font-semibold"><span className="h-2 w-2 rounded-full bg-primary" />Next available session</p><p className="mt-2 text-sm font-semibold">{formatInTimeZone(nextSlot.startsAt, nextSlot.timezone, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}</p><p className="mt-1 text-xs leading-5 text-primary/70">{nextSlot.venueName} · {nextSlot.timezone}</p></div> : <p className="my-5 text-sm leading-6 text-primary/70">No sessions are currently listed. Check back for new availability.</p>}
            <a href="#coach-availability" className={`mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-primary transition hover:bg-accent-soft ${focusRing}`}>{hasSessions ? "View availability" : "Session availability"}<ArrowDown className="h-4 w-4" aria-hidden /></a>
            <p className="mt-3 text-xs leading-5 text-primary/65">{PAYMENT_COPY}</p>
          </aside>
        </div>
      </header>

      <nav aria-label="Coach profile sections" className="mb-10 flex flex-wrap gap-x-6 gap-y-1 border-b border-primary/15 px-1 py-3 text-sm font-semibold sm:mb-12">
        {coach.description?.trim() ? <a href="#coach-about" className={`inline-flex min-h-11 items-center ${focusRing}`}>About the coach</a> : null}
        <a href="#coach-reviews" className={`inline-flex min-h-11 items-center ${focusRing}`}>Reviews</a>
        <a href="#coach-availability" className={`inline-flex min-h-11 items-center gap-2 ${focusRing}`}>Sessions<ArrowDown className="h-3.5 w-3.5" aria-hidden /></a>
        {locations.length || venues.length ? <a href="#coach-locations" className={`inline-flex min-h-11 items-center ${focusRing}`}>Where to train</a> : null}
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16">
        <div>
          {coach.description?.trim() ? <section id="coach-about" className="scroll-mt-28" aria-labelledby="coach-intro-heading"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/60">Meet your coach</p><h2 id="coach-intro-heading" className="mt-3 text-3xl">A little about me</h2><p className="mt-5 whitespace-pre-line text-base leading-8 text-primary/80">{coach.description.trim()}</p></section> : null}
          {coach.outcomes.length ? <section className={coach.description?.trim() ? "mt-8" : ""} aria-labelledby="coach-outcomes-heading"><h2 id="coach-outcomes-heading" className="text-xl">What we can work on</h2><ul className="mt-4 space-y-3">{coach.outcomes.map((label, i) => <li key={`${label}-${i}`} className="flex items-start gap-3 text-sm leading-6"><Check className="mt-1 h-4 w-4 shrink-0" aria-hidden /><span>{label}</span></li>)}</ul></section> : null}
        </div>
        {coach.audience.length || levels.length ? <section className="self-start rounded-2xl bg-secondary/25 p-6 sm:p-8" aria-labelledby="coach-audience-heading"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/65">Find your fit</p><h2 id="coach-audience-heading" className="mt-3 text-2xl">Who I coach</h2>{coach.audience.length ? <p className="mt-4 text-base font-medium">{coach.audience.join(" · ")}</p> : null}{levels.length ? <><p className="mt-6 text-xs font-semibold uppercase tracking-wider text-primary/65">Player levels</p><ul className="mt-3 flex flex-wrap gap-2" aria-label="Player levels">{levels.map((level) => <li key={level} className="rounded-lg bg-white px-3 py-2 text-sm font-medium">{level}</li>)}</ul></> : null}</section> : null}
      </div>

      <CoachPublicAvailabilitySection coachId={coach.id} coachName={coach.name ?? "Coach"} groups={availabilityGroups} />
      <CoachReviewsSection data={reviewsData} />

      {gallery.length ? <section className="mt-12" aria-labelledby="coach-gallery-heading"><h2 id="coach-gallery-heading" className="text-2xl">On and off the court</h2><ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">{gallery.map((url, i) => <li key={`${url}-${i}`}><CoachImage src={url} alt={`${displayName} — gallery photo ${i + 1}`} className="aspect-[4/3] w-full rounded-2xl object-cover" /></li>)}</ul></section> : null}

      {coach.achievements.length ? <section className="mt-12 border-t border-primary/15 pt-10" aria-labelledby="coach-achievements-heading"><h2 id="coach-achievements-heading" className="text-2xl">Experience & achievements</h2><p className="mt-2 text-sm text-primary/65">Shared by the coach — not independently verified.</p><ul className="mt-6 grid gap-4 sm:grid-cols-2">{coach.achievements.map((achievement, i) => <li key={`${achievement.title}-${i}`} className={`border-l-2 py-2 pl-5 ${achievement.is_highlight ? "border-primary" : "border-primary/20"}`}><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="font-semibold">{achievement.title}</p>{achievement.year != null ? <span className="text-sm text-primary/65">{achievement.year}</span> : null}</div>{achievement.description?.trim() ? <p className="mt-2 text-sm leading-6 text-primary/75">{achievement.description.trim()}</p> : null}</li>)}</ul></section> : null}

      {locations.length || venues.length ? <section id="coach-locations" className="mt-12 scroll-mt-28 border-t border-primary/15 pt-10" aria-labelledby="coach-locations-heading"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/60">The right setting</p><h2 id="coach-locations-heading" className="mt-3 text-3xl">Where to train</h2></div>{locations.length ? <div><p className="text-xs font-semibold text-primary/65">Coach&apos;s listed locations</p><ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">{locations.map((location, i) => <li key={`${location.full}-${i}`} className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 shrink-0" aria-hidden />{location.full}{i === 0 && locations.length > 1 ? <span className="text-primary/60">· Primary</span> : null}</li>)}</ul></div> : null}</div>{venues.length ? <><p className="mt-5 text-sm leading-6 text-primary/70">Partner venues for this coach. Your selected session shows where you&apos;ll train.</p><VenueCardsWithDistance venues={venues} className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" /></> : null}</section> : null}

      <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-primary/15 py-7"><p className="text-sm text-primary/70">Still exploring your options?</p><Link href="/coaches" className={`inline-flex min-h-11 items-center gap-2 text-sm font-semibold ${focusRing}`}>Find your coach<ArrowUpRight className="h-4 w-4" aria-hidden /></Link></div>
    </div>
  );
}
