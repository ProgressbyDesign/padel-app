import { loadCoachBookings, partitionCoachBookings } from "@/lib/queries/coachBookings";
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
    imageCount,
    socialCount,
    venueCount,
    achievementCount,
    audienceAdults,
    audienceJuniors,
    playerLevels,
    outcomes,
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
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[{label:"Awaiting response",value:pendingBookingCount,href:`${base}/bookings`},{label:"Upcoming sessions",value:partitionCoachBookings(bookings).upcoming.length,href:`${base}/bookings`},{label:"Completed sessions",value:bookings.filter(b => b.status === "completed").length,href:`${base}/bookings`},{label:"Coaching venues",value:venueCount,href:`${base}/venues`}].map(item => <Link key={item.label} href={item.href} className="rounded-2xl border border-primary/10 bg-white p-5 transition hover:border-primary/40"><p className="text-sm text-primary/60">{item.label}</p><p className="mt-3 text-3xl font-semibold">{item.value}</p></Link>)}
      </section>
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-primary p-6 text-white"><div><h2 className="text-xl text-white">{venueCount ? "Plan your next sessions" : "Where do you coach?"}</h2><p className="mt-2 text-sm text-white/75">{venueCount ? "Keep your venues and coaching availability up to date." : "Add a venue to start setting up your coaching sessions."}</p></div><Link href={`${base}/venues`} className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-primary">{venueCount ? "Manage venues" : "+ Add venue"}</Link></section>
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
