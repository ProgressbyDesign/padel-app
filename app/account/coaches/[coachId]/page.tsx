import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  ExternalLink,
} from "lucide-react";
import { buildCoachCompletion } from "@/lib/coachProfileCompletion";
import { formatCoachCardPrice } from "@/lib/formatCoachPrice";
import { loadManagedCoachOverview } from "@/lib/queries/managedCoach";

export const metadata: Metadata = {
  title: "Coach overview",
  description: "Review coach profile status and completeness.",
};

type PageProps = {
  params: Promise<{ coachId: string }>;
};

export default async function ManagedCoachOverviewPage({ params }: PageProps) {
  const { coachId } = await params;
  const result = await loadManagedCoachOverview(coachId);
  if (!result) notFound();

  const {
    coach,
    membershipRole,
    imageCount,
    socialCount,
    venueCount,
    achievementCount,
    audienceAdults,
    audienceJuniors,
    playerLevels,
    outcomes,
    primaryLocation,
    hasPrimaryLocation,
    availabilityStatus,
    nextAvailableAt,
    pendingBookingCount,
  } = result;

  const base = `/account/coaches/${encodeURIComponent(coach.id)}`;
  const completion = buildCoachCompletion(coach.id, {
    name: coach.name,
    role: coach.role,
    description: coach.description,
    experience_years: coach.experience_years,
    phone: coach.phone,
    email: coach.email,
    price_from: coach.price_from,
    image_url: coach.image_url,
    is_approved: coach.is_approved,
    hasPrimaryLocation,
    audienceAdults,
    audienceJuniors,
    playerLevels,
    outcomes,
    imageCount,
    socialCount,
    achievementCount,
    activeVenueCount: venueCount,
    availabilityLive: availabilityStatus === "live",
    pendingBookingCount,
  });

  const priceLine = formatCoachCardPrice(coach.price_from);

  return (
    <div className="space-y-8">
      <section className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-primary">Overview</h2>
            <p className="mt-1 text-sm text-primary/60">
              Complete your profile to help players understand your coaching and
              request the right sessions.
            </p>
          </div>
          <Link
            href={`/coach/${encodeURIComponent(coach.id)}`}
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

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl bg-surface p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Status
            </dt>
            <dd className="mt-2 font-semibold text-primary">
              {coach.is_approved ? "Approved" : "Not approved"}
            </dd>
          </div>
          <div className="rounded-2xl bg-surface p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Membership
            </dt>
            <dd className="mt-2 font-semibold capitalize text-primary">
              {membershipRole}
            </dd>
          </div>
          <div className="rounded-2xl bg-surface p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Primary location
            </dt>
            <dd className="mt-2 font-semibold text-primary">
              {primaryLocation || "Not set"}
            </dd>
          </div>
          <div className="rounded-2xl bg-surface p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Price from
            </dt>
            <dd className="mt-2 font-semibold text-primary">{priceLine.text}</dd>
          </div>
          <div className="rounded-2xl bg-surface p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Availability
            </dt>
            <dd className="mt-2 font-semibold text-primary">
              {availabilityStatus === "live"
                ? "Live"
                : availabilityStatus === "private"
                  ? "Private"
                  : "Not set"}
            </dd>
            {nextAvailableAt ? (
              <p className="mt-1 text-xs text-primary/55">Upcoming session set</p>
            ) : null}
          </div>
          <div className="rounded-2xl bg-surface p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Pending bookings
            </dt>
            <dd className="mt-2 font-semibold text-primary">
              {pendingBookingCount}
            </dd>
            {pendingBookingCount > 0 ? (
              <Link
                href={`${base}/bookings`}
                className="mt-2 inline-block text-xs font-semibold text-primary/70 hover:text-primary"
              >
                Review requests
              </Link>
            ) : null}
          </div>
        </dl>
      </section>

      <section className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-7">
        <div>
          <h2 className="text-2xl font-bold text-primary">Profile completeness</h2>
          <p className="mt-1 text-sm text-primary/60">
            Focus on essential details first, then trust signals and booking
            readiness. This is not a search ranking score.
          </p>
          <p className="mt-3 text-sm font-semibold text-primary">
            {completion.completedWeighted} of {completion.weightedTotal} core
            items complete
          </p>
        </div>

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
    </div>
  );
}
