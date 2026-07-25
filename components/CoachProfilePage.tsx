import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ExternalLink, Mail, MapPin, Phone, Star } from "lucide-react";
import type { CoachProfileView } from "../lib/coachProfileView";
import type { Venue } from "../lib/venueFilters";
import type { PublicVenueAvailabilityGroup } from "../lib/coachAvailability/types";
import EnquiryButton from "./enquiry/EnquiryButton";
import VenueCardsWithDistance from "./VenueCardsWithDistance";
import CoachProfileBack from "./CoachProfileBack";
import CoachImage from "./CoachImage";
import CoachPublicAvailabilitySection from "./CoachPublicAvailabilitySection";

type CoachProfilePageProps = {
  coach: CoachProfileView;
  venues: Venue[];
  availabilityGroups?: PublicVenueAvailabilityGroup[];
};

function formatRatingScore(score: number | null): string | null {
  if (score == null || Number.isNaN(score)) return null;
  if (Number.isInteger(score)) return String(score);
  return score.toFixed(1);
}

export default function CoachProfilePage({
  coach,
  venues,
  availabilityGroups = [],
}: CoachProfilePageProps) {
  const displayName = coach.name?.trim() || "Coach";
  const scoreLabel = formatRatingScore(coach.rating.score);
  const hasRating = scoreLabel != null;
  const hasReviews = coach.rating.count != null && coach.rating.count > 0;
  const hasContact =
    Boolean(coach.contact.email?.trim()) || Boolean(coach.contact.phone?.trim());
  const locationFull = coach.location.full?.trim() || "";
  const role = coach.role?.trim() || "";
  const gallery =
    coach.gallery.length > 1
      ? coach.gallery.slice(1)
      : coach.gallery.length === 0
        ? []
        : [];
  const showGallery = coach.gallery.length > 1;
  const levels = coach.playerLevels.length
    ? coach.playerLevels
    : coach.level?.trim()
      ? [coach.level.trim()]
      : [];
  const locationRows =
    coach.locations.length > 0
      ? coach.locations
      : locationFull
        ? [coach.location]
        : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <Suspense
        fallback={
          <Link
            href="/coaches"
            className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-primary/70 transition hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to coaches
          </Link>
        }
      >
        <CoachProfileBack />
      </Suspense>

      <header className="grid gap-8 border-b border-primary/10 pb-10 lg:grid-cols-[minmax(280px,400px)_1fr] lg:items-start lg:gap-10">
        <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
          <CoachImage
            src={coach.image}
            alt={`${displayName}, padel coach`}
            className="aspect-[4/5] w-full rounded-3xl object-cover object-[center_20%] shadow-[0_16px_48px_rgba(0,60,60,0.12)] ring-1 ring-primary/15 lg:aspect-[3/4] lg:min-h-[420px]"
          />
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold tracking-tight text-primary sm:text-4xl lg:text-[2.5rem]">
            {displayName}
          </h1>

          {role ? (
            <p className="mt-2 text-base font-medium text-primary/70">{role}</p>
          ) : null}

          {locationFull ? (
            <p className="mt-3 flex items-start gap-2 text-sm font-semibold text-primary/80">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-secondary" aria-hidden />
              <span>{locationFull}</span>
            </p>
          ) : null}

          {coach.badges.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Profile badges">
              {coach.badges.map((badge) => (
                <li
                  key={badge.id}
                  className="rounded-lg border border-primary/12 bg-surface px-2.5 py-1 text-xs font-semibold text-primary/80"
                >
                  {badge.label}
                </li>
              ))}
            </ul>
          ) : null}

          <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm text-primary/80">
            {coach.experience?.trim() ? (
              <div>
                <dt className="sr-only">Experience</dt>
                <dd>
                  <span className="font-medium text-primary">Experience:</span>{" "}
                  {coach.experience.trim()}
                </dd>
              </div>
            ) : null}
            {hasRating ? (
              <div className="flex items-center gap-1.5">
                <Star
                  className="h-4 w-4 shrink-0 fill-secondary text-secondary"
                  aria-hidden
                />
                <dt className="sr-only">Rating</dt>
                <dd className="font-medium text-primary">
                  {scoreLabel}
                  {hasReviews ? (
                    <span className="font-normal text-primary/60">
                      {" "}
                      ({coach.rating.count!.toLocaleString()} reviews)
                    </span>
                  ) : null}
                </dd>
              </div>
            ) : null}
            {coach.travel === true ? (
              <div>
                <dt className="sr-only">Travel</dt>
                <dd className="font-medium text-primary">Travels to coach</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </header>

      {showGallery ? (
        <section className="mt-10" aria-label="Photo gallery">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {gallery.map((url) => (
              <li key={url}>
                <CoachImage
                  src={url}
                  alt=""
                  className="aspect-[4/3] w-full rounded-2xl object-cover ring-1 ring-primary/10"
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {coach.description?.trim() ? (
        <section className="mt-10 border-t border-primary/10 pt-10" aria-labelledby="coach-intro-heading">
          <h2
            id="coach-intro-heading"
            className="text-lg font-semibold tracking-tight text-primary sm:text-xl"
          >
            About
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-primary/75 sm:text-base">
            {coach.description.trim()}
          </p>
        </section>
      ) : null}

      {coach.pricing.displayFrom?.trim() ? (
        <section className="mt-8" aria-label="Pricing">
          <p className="text-base font-semibold text-primary">
            {coach.pricing.displayFrom.trim()}
          </p>
        </section>
      ) : null}

      {coach.audience.length > 0 || levels.length > 0 ? (
        <section
          className="mt-10 border-t border-primary/10 pt-10"
          aria-labelledby="coach-audience-heading"
        >
          <h2
            id="coach-audience-heading"
            className="text-lg font-semibold tracking-tight text-primary sm:text-xl"
          >
            Who I coach
          </h2>
          {coach.audience.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Audience">
              {coach.audience.map((label) => (
                <li
                  key={label}
                  className="rounded-full border border-primary/15 bg-surface px-3 py-1 text-xs font-medium text-primary/80"
                >
                  {label}
                </li>
              ))}
            </ul>
          ) : null}
          {levels.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Player levels">
              {levels.map((label) => (
                <li
                  key={label}
                  className="rounded-full border border-primary/15 bg-white px-3 py-1 text-xs font-medium text-primary/80"
                >
                  {label}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {coach.outcomes.length > 0 ? (
        <section
          className="mt-10 border-t border-primary/10 pt-10"
          aria-labelledby="coach-outcomes-heading"
        >
          <h2
            id="coach-outcomes-heading"
            className="text-lg font-semibold tracking-tight text-primary sm:text-xl"
          >
            Coaching focus
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Coaching outcomes">
            {coach.outcomes.map((label, i) => (
              <li
                key={`${label}-${i}`}
                className="rounded-full border border-secondary/25 bg-secondary/10 px-3 py-1 text-xs font-semibold text-primary"
              >
                {label}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {locationRows.length > 0 || venues.length > 0 ? (
        <section
          className="mt-10 border-t border-primary/10 pt-10"
          aria-labelledby="coach-locations-heading"
        >
          <h2
            id="coach-locations-heading"
            className="text-lg font-semibold tracking-tight text-primary sm:text-xl"
          >
            Locations and venues
          </h2>
          {locationRows.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm text-primary/80">
              {locationRows.map((row, index) => (
                <li key={`${row.full}-${index}`} className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-secondary" aria-hidden />
                  <span>
                    {row.full}
                    {index === 0 && coach.locations.length > 1 ? (
                      <span className="text-primary/50"> · Primary</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {venues.length > 0 ? (
            <div className="mt-6">
              <p className="text-sm text-primary/65">Venues where this coach is listed.</p>
              <VenueCardsWithDistance
                venues={venues}
                className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
              />
            </div>
          ) : null}
        </section>
      ) : null}

      <CoachPublicAvailabilitySection coachId={coach.id} groups={availabilityGroups} />

      {coach.achievements.length > 0 ? (
        <section
          className="mt-10 border-t border-primary/10 pt-10 sm:mt-12 sm:pt-12"
          aria-labelledby="coach-achievements-heading"
        >
          <h2
            id="coach-achievements-heading"
            className="text-lg font-semibold tracking-tight text-primary sm:text-xl"
          >
            Achievements
          </h2>
          <p className="mt-1 text-sm text-primary/55">
            Shared by the coach — not independently verified.
          </p>
          <ul className="mt-6 space-y-4">
            {coach.achievements.map((a, i) => (
              <li
                key={`${a.title}-${a.year ?? i}`}
                className={`rounded-2xl border px-4 py-4 sm:px-5 sm:py-5 ${
                  a.is_highlight
                    ? "border-primary/25 bg-primary/[0.04]"
                    : "border-primary/10 bg-white"
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-primary">{a.title}</p>
                  {typeof a.year === "number" ? (
                    <span className="text-xs font-medium tabular-nums text-primary/50">
                      {a.year}
                    </span>
                  ) : null}
                </div>
                {a.description?.trim() ? (
                  <p className="mt-2 text-sm leading-relaxed text-primary/70">
                    {a.description.trim()}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {coach.socials.length > 0 ? (
        <section
          className="mt-10 border-t border-primary/10 pt-10"
          aria-labelledby="coach-socials-heading"
        >
          <h2
            id="coach-socials-heading"
            className="text-lg font-semibold tracking-tight text-primary sm:text-xl"
          >
            Social
          </h2>
          <ul className="mt-4 flex flex-wrap gap-3">
            {coach.socials.map((social) => (
              <li key={`${social.platform}-${social.url}`}>
                <a
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-primary/15 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-surface"
                >
                  {social.label}
                  <ExternalLink className="h-3.5 w-3.5 text-primary/45" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {hasContact ? (
        <ul className="mt-10 flex flex-wrap gap-4 border-t border-primary/10 pt-10 text-sm">
          {coach.contact.email?.trim() ? (
            <li>
              <a
                href={`mailto:${coach.contact.email.trim()}`}
                className="inline-flex items-center gap-2 font-medium text-primary underline-offset-4 hover:underline"
              >
                <Mail className="h-4 w-4 shrink-0 text-secondary" aria-hidden />
                {coach.contact.email.trim()}
              </a>
            </li>
          ) : null}
          {coach.contact.phone?.trim() ? (
            <li>
              <a
                href={`tel:${coach.contact.phone.trim().replace(/\s+/g, "")}`}
                className="inline-flex items-center gap-2 font-medium text-primary underline-offset-4 hover:underline"
              >
                <Phone className="h-4 w-4 shrink-0 text-secondary" aria-hidden />
                {coach.contact.phone.trim()}
              </a>
            </li>
          ) : null}
        </ul>
      ) : null}

      <div className="mt-10 rounded-[24px] border border-primary/10 bg-white p-6 shadow-[0_8px_28px_rgba(3,19,34,0.04)]">
        <h2 className="text-lg font-semibold text-primary">Book a session</h2>
        <p className="mt-2 text-sm text-primary/65">
          Send a request to this coach. They will follow up to confirm details.
        </p>
        <div className="mt-5">
          <EnquiryButton coachId={coach.id} />
        </div>
      </div>
    </div>
  );
}
