import Link from "next/link";
import { countApplicationStatuses } from "@/lib/admin/applicationQueries";
import {
  hasAdminPermission,
  ROLE_LABELS,
} from "@/lib/admin/permissions";
import type { ProfileDirectoryStats } from "@/lib/admin/profileDirectory";
import { loadAdminProfileDirectoryStats } from "@/lib/admin/profileDirectoryQueries";
import { requireAdminAccess } from "@/lib/auth/adminSession";
import { createClient } from "@/lib/supabase/server";

const STATUSES = [
  { key: "submitted", label: "Submitted" },
  { key: "under_review", label: "Under review" },
  { key: "changes_requested", label: "Changes requested" },
] as const;

export default async function AdminOverviewPage() {
  const account = await requireAdminAccess();
  const canApps = hasAdminPermission(account, "applications.read");
  const canProfiles = hasAdminPermission(account, "profiles.read");
  const canRelationships = hasAdminPermission(account, "relationships.read");
  const canDeletions = hasAdminPermission(account, "deletions.read");
  const canTeam = hasAdminPermission(account, "team.manage");
  const canBookings = hasAdminPermission(account, "bookings.read");
  const canAudit = hasAdminPermission(account, "audit.read");

  const [counts, pendingInvites, openDeletions, pendingRelationships, profileStats] =
    await Promise.all([
      canApps ? countApplicationStatuses() : Promise.resolve(null),
      canTeam ? countPendingInvitations() : Promise.resolve(null),
      canDeletions ? countOpenDeletions() : Promise.resolve(null),
      canRelationships ? countPendingRelationships() : Promise.resolve(null),
      canProfiles ? loadAdminProfileDirectoryStats() : Promise.resolve(null),
    ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
          Admin workspace · {ROLE_LABELS[account.role]}
        </p>
        <h1 className="mt-2">Overview</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-primary/60">
          Tools available for your role across profiles, applications,
          relationships, and operational queues.
        </p>
      </div>

      {profileStats ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <ProfileDirectoryCard
            title="Coaches"
            href="/admin/coaches"
            stats={profileStats.coaches}
          />
          <ProfileDirectoryCard
            title="Venues"
            href="/admin/venues"
            stats={profileStats.venues}
          />
        </div>
      ) : null}

      {counts ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <ApplicationOverview
            title="Coach applications"
            href="/admin/applications/coaches"
            counts={counts.coach}
          />
          <ApplicationOverview
            title="Venue applications"
            href="/admin/applications/venues"
            counts={counts.venue}
          />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {canRelationships ? (
          <QuickCard
            title="Relationships"
            href="/admin/relationships"
            value={pendingRelationships ?? 0}
            hint="Pending or unverified"
          />
        ) : null}
        {canDeletions ? (
          <QuickCard
            title="Account deletions"
            href="/admin/account-deletions"
            value={openDeletions ?? 0}
            hint="Requested or processing"
          />
        ) : null}
        {canTeam ? (
          <QuickCard
            title="Team invitations"
            href="/admin/team"
            value={pendingInvites ?? 0}
            hint="Pending invites"
          />
        ) : null}
        {canBookings ? (
          <QuickCard
            title="Bookings"
            href="/admin/bookings"
            value="Open"
            hint="Review session requests"
          />
        ) : null}
        {canAudit ? (
          <QuickCard
            title="Audit log"
            href="/admin/audit"
            value="View"
            hint="Administrative history"
          />
        ) : null}
      </div>
    </div>
  );
}

function ProfileDirectoryCard({
  title,
  href,
  stats,
}: {
  title: string;
  href: string;
  stats: ProfileDirectoryStats;
}) {
  return (
    <Link
      href={href}
      className="rounded-[24px] border border-primary/10 bg-white p-5 transition hover:border-primary/20"
    >
      <p className="text-sm font-semibold text-primary">{title}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight">{stats.total}</p>
      <p className="mt-1 text-xs text-primary/50">
        {stats.selected} selected · {stats.published} published
      </p>
    </Link>
  );
}

function ApplicationOverview({
  title,
  href,
  counts,
}: {
  title: string;
  href: string;
  counts: Awaited<ReturnType<typeof countApplicationStatuses>>["coach"];
}) {
  return (
    <section className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl">{title}</h2>
        <Link
          href={href}
          className="text-sm font-semibold text-primary/60 hover:text-primary"
        >
          Open queue →
        </Link>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {STATUSES.map(({ key, label }) => (
          <Link
            key={key}
            href={`${href}?status=${key}`}
            className="rounded-2xl border border-primary/10 bg-surface/60 p-4 transition hover:border-primary/20 hover:bg-surface"
          >
            <span className="block text-2xl font-bold">{counts[key]}</span>
            <span className="mt-1 block text-xs leading-4 text-primary/55">
              {label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function QuickCard({
  title,
  href,
  value,
  hint,
}: {
  title: string;
  href: string;
  value: number | string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-[24px] border border-primary/10 bg-white p-5 transition hover:border-primary/20"
    >
      <p className="text-sm font-semibold text-primary">{title}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-primary/50">{hint}</p>
    </Link>
  );
}

async function countPendingInvitations(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("admin_invitations")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) return 0;
  return count ?? 0;
}

async function countOpenDeletions(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("account_deletion_requests")
    .select("id", { count: "exact", head: true })
    .in("status", ["requested", "processing"]);
  if (error) return 0;
  return count ?? 0;
}

async function countPendingRelationships(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("coach_venues")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "unverified"]);
  if (error) return 0;
  return count ?? 0;
}
