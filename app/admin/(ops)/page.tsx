import Link from "next/link";
import { countApplicationStatuses } from "@/lib/admin/applicationQueries";

const STATUSES = [
  { key: "submitted", label: "Submitted" },
  { key: "under_review", label: "Under review" },
  { key: "changes_requested", label: "Changes requested" },
] as const;

export default async function AdminOverviewPage() {
  const counts = await countApplicationStatuses();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
          Operations
        </p>
        <h1 className="mt-2">Overview</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-primary/60">
          Review authenticated coach and venue applications and connect approved
          applicants to managed profiles.
        </p>
      </div>

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
    </div>
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
        <Link href={href} className="text-sm font-semibold text-primary/60 hover:text-primary">
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
            <span className="mt-1 block text-xs leading-4 text-primary/55">{label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
