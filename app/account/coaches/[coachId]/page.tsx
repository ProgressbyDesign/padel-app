import CoachImage from "@/components/CoachImage";
import { loadCoachBookings } from "@/lib/queries/coachBookings";
import { formatBookingWhen } from "@/lib/coachBookings/display";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CoachCompletionPanel from "@/components/account/CoachCompletionPanel";
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
    pricingConfigured,
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
    pricingConfigured,
    hasFutureSession: Boolean(nextAvailableAt),
    pendingBookingCount,
  });

  const bookings = await loadCoachBookings(coachId);
  const latest = [...bookings].sort((a,b) => Date.parse(b.created_at)-Date.parse(a.created_at))[0];
  const priceLine = formatCoachCardPrice(coach.price_from);

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-center gap-5 rounded-3xl bg-primary p-6 text-white">
        <CoachImage src={coach.image_url} alt={coach.name ?? "Coach"} className="h-24 w-24 rounded-2xl object-cover" />
        <div><h2 className="text-3xl text-white">{coach.name}</h2><p className="mt-2 text-sm text-white/80">{primaryLocation || "Add your primary location"}</p><Link href={`/coach/${coach.id}`} className="mt-3 inline-block text-sm text-accent underline">View public profile</Link></div>
      </section>
      <section className="rounded-3xl border border-primary/10 bg-white p-6">
        <div className="flex justify-between gap-4"><h2 className="text-2xl">Latest booking</h2><Link href={`${base}/bookings`} className="text-sm font-semibold underline">All bookings</Link></div>
        {latest ? <div className="mt-4"><p className="font-semibold">{latest.requester_name}</p><p className="mt-2 text-sm text-primary/65">{formatBookingWhen(latest)} · {latest.venue?.name ?? "Venue"}</p><p className="mt-2 text-sm capitalize">{latest.status} · {latest.paid_at ? "Paid" : "Payment not recorded"}</p></div> : <p className="mt-4 text-sm text-primary/65">Your latest booking will appear here.</p>}
      </section>
      <section className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-7">
        <div>
          <h2 className="text-2xl text-primary">Overview</h2>
          <p className="mt-1 text-sm text-primary/60">
            Complete your profile to help players understand your coaching and
            request the right sessions.
          </p>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl bg-surface p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Status
            </dt>
            <dd className="mt-2 font-semibold text-primary">
              {coach.is_approved ? "Confirmed" : "Not confirmed"}
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
              {availabilityStatus === "live" ? "Live" : "Not configured"}
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

      <CoachCompletionPanel
        overallPercent={completion.overallPercent}
        groupScores={completion.groupScores}
        groups={completion.groups}
        items={completion.items}
        completedWeighted={completion.completedWeighted}
        weightedTotal={completion.weightedTotal}
        improveHref={`${base}/details`}
      />
    </div>
  );
}
