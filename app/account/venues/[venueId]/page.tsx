import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Circle,
  ExternalLink,
  ImageIcon,
  Link2,
  PenSquare,
  Star,
  UserRound,
} from "lucide-react";
import CompletionProgressRings from "@/components/account/CompletionProgressRings";
import { formatInTimeZone } from "@/lib/coachAvailability/timezone";
import { buildVenueCompletion } from "@/lib/coachProfileCompletion";
import { loadManagedVenueOverview } from "@/lib/queries/managedVenue";
import { loadVenueOpsOverview } from "@/lib/queries/venueOperations";
import { getStructuredOpeningHours } from "@/lib/openingHours";

export const metadata: Metadata = {
  title: "Venue overview",
  description: "Review venue listing status and completeness on Padel Pathways.",
};

type PageProps = {
  params: Promise<{ venueId: string }>;
};

function formatNextSession(
  startsAt: string,
  timezone: string
): string {
  return formatInTimeZone(startsAt, timezone, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

export default async function ManagedVenueOverviewPage({ params }: PageProps) {
  const { venueId } = await params;
  const [result, ops] = await Promise.all([
    loadManagedVenueOverview(venueId),
    loadVenueOpsOverview(venueId),
  ]);
  if (!result) notFound();

  const {
    venue,
    imageCount,
    socialCount,
    activeCoachCount,
    hasCoachAvailability,
  } = result;
  const venueName = venue.name?.trim() || "Venue";
  const location = [venue.city, venue.country].filter(Boolean).join(", ");
  const base = `/account/venues/${encodeURIComponent(venue.id)}`;
  const hasHours = Boolean(
    getStructuredOpeningHours(venue.opening_hours_structured)
  );
  const completion = buildVenueCompletion(venue.id, {
    name: venue.name,
    city: venue.city,
    country: venue.country,
    address: venue.address,
    website: venue.website,
    phone: venue.phone,
    courts: venue.courts,
    courtType: venue.court_type,
    venueType: venue.venue_type,
    hasOpeningHours: hasHours,
    imageCount,
    socialCount,
    hasCoachingDescription: Boolean(venue.coaching_description?.trim()),
    activeCoachCount,
    hasCoachAvailability,
    isVerified: Boolean(venue.is_approved),
  });

  const summary = ops?.summary;
  const alerts = ops?.alerts ?? [];
  const nextSession = ops?.nextSession ?? null;

  const summaryCards: Array<{ label: string; value: string }> = summary
    ? [
        { label: "Active coaches", value: String(summary.activeCoaches) },
        { label: "Public coaches", value: String(summary.publicCoaches) },
        { label: "Hidden schedules", value: String(summary.hiddenSchedules) },
        {
          label: "Sessions this week",
          value: String(summary.sessionsThisWeek),
        },
        {
          label: "Confirmed sessions",
          value: String(summary.confirmedFuture),
        },
        {
          label: "Pending coach relationships",
          value: String(summary.pendingRelationships),
        },
        {
          label: "Next session",
          value: nextSession
            ? formatNextSession(nextSession.starts_at, nextSession.timezone)
            : "None",
        },
      ]
    : [];

  return (
    <div className="space-y-8">
      <section className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-primary">Overview</h2>
            <p className="mt-1 text-sm text-primary/60">
              Current public and account status for this venue.
            </p>
          </div>
          <Link
            href={`/venue/${encodeURIComponent(venue.id)}`}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary/15 px-4 py-2 text-sm font-semibold text-primary/80 hover:bg-surface"
          >
            Public preview
            <ExternalLink className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        {completion.badges.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {completion.badges.map((badge) => (
              <li
                key={badge.id}
                className="rounded-lg border border-primary/10 bg-surface px-2.5 py-1 text-xs font-semibold text-primary/80"
              >
                {badge.label}
              </li>
            ))}
          </ul>
        ) : null}

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-surface p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Venue
            </dt>
            <dd className="mt-2 font-semibold text-primary">{venueName}</dd>
            <dd className="mt-1 text-sm text-primary/60">
              {location || "Location not provided"}
            </dd>
          </div>

          <div className="rounded-2xl bg-surface p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Public rating
            </dt>
            <dd className="mt-2 flex items-center gap-1.5 font-semibold text-primary">
              {venue.rating === null ? (
                "No rating yet"
              ) : (
                <>
                  <Star className="h-4 w-4 fill-accent text-primary" aria-hidden />
                  {venue.rating.toFixed(1)}
                  {venue.review_count !== null ? (
                    <span className="font-normal text-primary/55">
                      ({venue.review_count} reviews)
                    </span>
                  ) : null}
                </>
              )}
            </dd>
          </div>

          <div className="rounded-2xl bg-surface p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Courts
            </dt>
            <dd className="mt-2 font-semibold text-primary">
              {venue.courts === null ? "Not set" : venue.courts}
            </dd>
            <dd className="mt-1 text-sm text-primary/60">
              {venue.court_type?.trim() || "Court type not set"}
            </dd>
          </div>

          <div className="rounded-2xl bg-surface p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Coaching
            </dt>
            <dd className="mt-2 font-semibold text-primary">
              {venue.coaching_available ? "Available" : "Not listed"}
            </dd>
            <dd className="mt-1 text-sm text-primary/60">
              {activeCoachCount} active coach
              {activeCoachCount === 1 ? "" : "es"}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-primary/10 px-4 py-3 text-sm text-primary/65">
          <CheckCircle2
            className={`h-4 w-4 shrink-0 ${
              venue.google_place_id ? "text-emerald-600" : "text-primary/35"
            }`}
            aria-hidden
          />
          {venue.google_place_id
            ? "Connected to a Google Place"
            : "No Google Place connection"}
        </div>
      </section>

      {summaryCards.length > 0 ? (
        <section className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-7">
          <div>
            <h2 className="text-2xl font-bold text-primary">Operations</h2>
            <p className="mt-1 text-sm text-primary/60">
              Coaching schedule and booking activity for this venue.
            </p>
          </div>

          <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-primary/10 bg-surface/60 p-4"
              >
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
                  {card.label}
                </dt>
                <dd className="mt-2 text-lg font-bold text-primary">
                  {card.value}
                </dd>
              </div>
            ))}
          </dl>

          {alerts.length > 0 ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
              <h3 className="text-sm font-bold text-amber-950">
                Needs attention
              </h3>
              <ul className="mt-3 space-y-2">
                {alerts.map((alert) => (
                  <li key={alert.id}>
                    <Link
                      href={alert.href}
                      className="flex items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-white/70 px-3 py-2.5 text-sm font-semibold text-amber-950 transition hover:bg-white"
                    >
                      <span>{alert.message}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`${base}/schedule`}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-accent"
            >
              <Calendar className="h-4 w-4" aria-hidden />
              View schedule
            </Link>
            <Link
              href={`${base}/coaches`}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/15 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-surface"
            >
              <UserRound className="h-4 w-4" aria-hidden />
              Manage coaches
            </Link>
            <Link
              href={`/venue/${encodeURIComponent(venue.id)}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/15 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-surface"
            >
              View public venue
              <ExternalLink className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </section>
      ) : null}

      <section className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-7">
        <div>
          <h2 className="text-2xl font-bold text-primary">Completeness</h2>
          <p className="mt-1 text-sm text-primary/60">
            Focus on essential details first, then trust signals and coach
            readiness. This is not a search ranking score.
          </p>
        </div>

        <div className="mt-6">
          <CompletionProgressRings
            overallPercent={completion.overallPercent}
            groupScores={completion.groupScores}
          />
        </div>

        <p className="mt-6 text-sm font-semibold text-primary">
          {completion.completedWeighted} of {completion.weightedTotal} core
          items complete
        </p>

        <div className="mt-6 space-y-6">
          {completion.groups.map((group) => (
            <div key={group.id}>
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-primary/45">
                {group.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-3 rounded-2xl border border-primary/10 px-4 py-3 transition hover:bg-surface"
                    >
                      {item.done ? (
                        <CheckCircle2
                          className="h-5 w-5 shrink-0 text-emerald-600"
                          aria-hidden
                        />
                      ) : (
                        <Circle
                          className="h-5 w-5 shrink-0 text-primary/30"
                          aria-hidden
                        />
                      )}
                      <span className="flex-1 text-sm font-semibold text-primary">
                        {item.label}
                      </span>
                      <ArrowRight
                        className="h-4 w-4 text-primary/40"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Link
          href={`${base}/details`}
          className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] transition hover:border-primary/20 hover:bg-surface"
        >
          <PenSquare className="h-5 w-5 text-primary" aria-hidden />
          <h3 className="mt-4 text-lg font-bold text-primary">Details</h3>
          <p className="mt-1 text-sm text-primary/60">
            Basic info, hours, and location.
          </p>
        </Link>
        <Link
          href={`${base}/images`}
          className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] transition hover:border-primary/20 hover:bg-surface"
        >
          <ImageIcon className="h-5 w-5 text-primary" aria-hidden />
          <h3 className="mt-4 text-lg font-bold text-primary">Images</h3>
          <p className="mt-1 text-sm text-primary/60">
            {imageCount === 0
              ? "No images yet"
              : `${imageCount} image${imageCount === 1 ? "" : "s"}`}
          </p>
        </Link>
        <Link
          href={`${base}/socials`}
          className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] transition hover:border-primary/20 hover:bg-surface"
        >
          <Link2 className="h-5 w-5 text-primary" aria-hidden />
          <h3 className="mt-4 text-lg font-bold text-primary">Social links</h3>
          <p className="mt-1 text-sm text-primary/60">
            {socialCount === 0
              ? "No links yet"
              : `${socialCount} link${socialCount === 1 ? "" : "s"}`}
          </p>
        </Link>
      </section>
    </div>
  );
}
