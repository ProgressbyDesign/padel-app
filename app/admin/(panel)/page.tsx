import Link from "next/link";
import { AdminPageHeader, StatCard } from "@/components/admin/ui";
import { fetchAdminDashboardStats } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  let stats;
  let error: string | null = null;
  try {
    stats = await fetchAdminDashboardStats();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load stats";
    stats = {
      venueCount: 0,
      coachCount: 0,
      coachesWithoutVenue: 0,
      coachesWithoutImage: 0,
      venuesWithoutSocials: 0,
      coachesNeedingReview: 0,
      venuesNeedingReview: 0,
    };
  }

  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        description="Overview of imported crawler data and review backlog."
      />
      {error ? (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}. Ensure <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code> is set.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total venues" value={stats.venueCount} href="/admin/venues" />
        <StatCard label="Total coaches" value={stats.coachCount} href="/admin/coaches" />
        <StatCard
          label="Coaches without venue links"
          value={stats.coachesWithoutVenue}
          href="/admin/coach-venue-links"
        />
        <StatCard
          label="Coaches without images"
          value={stats.coachesWithoutImage}
          href="/admin/review-queue?filter=coaches_without_image"
        />
        <StatCard
          label="Venues without socials"
          value={stats.venuesWithoutSocials}
          href="/admin/review-queue?filter=venues_without_socials"
        />
        <StatCard
          label="Coaches needing review"
          value={stats.coachesNeedingReview}
          href="/admin/review-queue?filter=coaches_low_confidence"
        />
        <StatCard
          label="Venues needing review"
          value={stats.venuesNeedingReview}
          href="/admin/review-queue?filter=venues_needing_review"
        />
      </div>
      <p className="mt-8 text-sm text-primary/60">
        Quick links:{" "}
        <Link href="/admin/review-queue" className="text-secondary underline">
          Review queue
        </Link>
        {" · "}
        <Link href="/admin/coach-venue-links" className="text-secondary underline">
          Link coaches to venues
        </Link>
      </p>
    </>
  );
}
