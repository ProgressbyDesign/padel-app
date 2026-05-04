import Link from "next/link";
import { ArrowLeft, Mail, MapPin, Phone, Star, User } from "lucide-react";
import type { CoachProfileView } from "../lib/coachProfileView";
import type { Venue } from "../lib/venueFilters";
import EnquiryButton from "./enquiry/EnquiryButton";
import VenueCardsWithDistance from "./VenueCardsWithDistance";

type CoachProfilePageProps = {
  coach: CoachProfileView;
  venues: Venue[];
};

function formatRatingScore(score: number | null): string | null {
  if (score == null || Number.isNaN(score)) return null;
  if (Number.isInteger(score)) return String(score);
  return score.toFixed(1);
}

export default function CoachProfilePage({ coach, venues }: CoachProfilePageProps) {
  const displayName = coach.name?.trim() || "Coach";
  const portraitUrl = coach.image?.trim() || null;
  const scoreLabel = formatRatingScore(coach.rating.score);
  const hasRating = scoreLabel != null;
  const hasReviews = coach.rating.count != null && coach.rating.count > 0;
  const hasContact = Boolean(coach.contact.email?.trim()) || Boolean(coach.contact.phone?.trim());
  const hasMetaLine =
    Boolean(coach.location.full?.trim()) ||
    Boolean(coach.experience?.trim()) ||
    hasRating ||
    coach.travel === true ||
    Boolean(coach.pricing.displayFrom?.trim());

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/venues"
        className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-primary/70 transition hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to venues
      </Link>

      <header className="flex flex-col gap-6 border-b border-primary/10 pb-10 sm:flex-row sm:items-start sm:gap-8">
        {portraitUrl ? (
          <img
            src={portraitUrl}
            alt=""
            className="h-32 w-32 shrink-0 rounded-2xl object-cover ring-1 ring-primary/15 sm:h-40 sm:w-40"
          />
        ) : (
          <div
            className="flex h-32 w-32 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-surface to-primary/10 ring-1 ring-primary/15 sm:h-40 sm:w-40"
            aria-hidden
          >
            <User className="h-14 w-14 text-secondary sm:h-16 sm:w-16" strokeWidth={1.25} />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold tracking-tight text-primary sm:text-4xl">{displayName}</h1>

          {coach.level?.trim() ? (
            <p className="mt-2 text-base font-medium text-primary/70">{coach.level.trim()}</p>
          ) : null}

          {coach.primaryOutcome?.trim() ? (
            <p className="mt-3 inline-flex max-w-full rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1.5 text-sm font-semibold text-primary">
              {coach.primaryOutcome.trim()}
            </p>
          ) : null}

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

          <div className="mt-5">
            <EnquiryButton coachId={coach.id} />
          </div>

          {coach.outcomes.length > 0 ? (
            <div className="mt-5" aria-labelledby="coach-outcomes-heading">
              <h2 id="coach-outcomes-heading" className="text-xs font-semibold uppercase tracking-wide text-primary/50">
                Helps with
              </h2>
              <ul className="mt-2 flex flex-wrap gap-2" aria-label="Coaching outcomes">
                {coach.outcomes.map((label, i) => (
                  <li
                    key={`${label}-${i}`}
                    className="rounded-full border border-secondary/25 bg-secondary/10 px-3 py-1 text-xs font-semibold text-primary"
                  >
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-5 text-sm font-medium text-primary/65">General coaching available</p>
          )}

          {hasMetaLine ? (
            <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm text-primary/80">
              {coach.location.full?.trim() ? (
                <div className="flex min-w-0 items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-secondary" aria-hidden />
                  <div>
                    <dt className="sr-only">Location</dt>
                    <dd className="font-medium text-primary">{coach.location.full.trim()}</dd>
                  </div>
                </div>
              ) : null}
              {coach.experience?.trim() ? (
                <div>
                  <dt className="sr-only">Experience</dt>
                  <dd>
                    <span className="font-medium text-primary">Experience:</span> {coach.experience.trim()}
                  </dd>
                </div>
              ) : null}
              {hasRating ? (
                <div className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 shrink-0 fill-secondary text-secondary" aria-hidden />
                  <dt className="sr-only">Rating</dt>
                  <dd className="font-medium text-primary">
                    {scoreLabel}
                    {hasReviews ? (
                      <span className="font-normal text-primary/60"> ({coach.rating.count!.toLocaleString()} reviews)</span>
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
              {coach.pricing.displayFrom?.trim() ? (
                <div>
                  <dt className="sr-only">Pricing</dt>
                  <dd className="font-semibold text-primary">{coach.pricing.displayFrom.trim()}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          {hasContact ? (
            <ul className="mt-6 flex flex-wrap gap-4 text-sm">
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

          {coach.description?.trim() ? (
            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-primary/70 sm:text-base">{coach.description.trim()}</p>
          ) : null}
        </div>
      </header>

      {coach.achievementsHero.length > 0 ? (
        <section className="mt-10 border-t border-primary/10 pt-10 sm:mt-12 sm:pt-12" aria-labelledby="coach-achievements-heading">
          <h2 id="coach-achievements-heading" className="text-lg font-semibold tracking-tight text-primary sm:text-xl">
            Achievements
          </h2>
          <ul className="mt-6 space-y-4">
            {coach.achievementsHero.map((a, i) => (
              <li
                key={`${a.title}-${a.year ?? i}`}
                className={`rounded-2xl border px-4 py-4 sm:px-5 sm:py-5 ${
                  a.is_highlight ? "border-primary/25 bg-primary/[0.04]" : "border-primary/10 bg-white"
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-primary">{a.title}</p>
                  {typeof a.year === "number" ? (
                    <span className="text-xs font-medium tabular-nums text-primary/50">{a.year}</span>
                  ) : null}
                </div>
                {a.description?.trim() ? (
                  <p className="mt-2 text-sm leading-relaxed text-primary/70">{a.description.trim()}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10 sm:mt-12">
        <h2 className="text-lg font-semibold tracking-tight text-primary sm:text-xl">Coaches at</h2>
        <p className="mt-1 text-sm text-primary/70">Venues where this coach is listed.</p>

        {venues.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-primary/20 bg-white px-6 py-12 text-center">
            <p className="text-sm font-medium text-primary">No venues linked yet</p>
            <p className="mt-1 text-sm text-primary/70">Check back later or explore all venues.</p>
            <Link
              href="/venues"
              className="mt-4 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90"
            >
              Explore venues
            </Link>
          </div>
        ) : (
          <VenueCardsWithDistance
            venues={venues}
            className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          />
        )}
      </section>
    </div>
  );
}
