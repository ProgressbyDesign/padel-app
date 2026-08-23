import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { AdminLifecycleStatus } from "@/components/admin/AdminLifecycleStatus";
import { AdminPublicationControls } from "@/components/admin/AdminPublicationControls";
import { loadOpsVenueOverview } from "@/lib/admin/opsProfileQueries";
import {
  accountHasPermission,
  requireAdminPermission,
} from "@/lib/auth/adminSession";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ venueId: string }>;
};

export default async function OpsVenueOverviewPage({ params }: PageProps) {
  const { venueId } = await params;
  const admin = await requireAdminPermission("profiles.read", "not-found");
  const data = await loadOpsVenueOverview(venueId);
  if (!data) notFound();

  const { venue, completion } = data;
  const name = venue.name?.trim() || "Venue";
  const location = [venue.city, venue.country].filter(Boolean).join(", ");
  const canManageProfiles = accountHasPermission(admin, "profiles.manage");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/venues"
          className="text-sm font-semibold text-primary/60 hover:text-primary"
        >
          ← Venues
        </Link>
        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
          Ops · Venue profile
        </p>
        <h1 className="mt-2">{name}</h1>
        <p className="mt-1 break-all text-xs text-primary/45">{venue.id}</p>
      </div>

      {completion.badges.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {completion.badges.map((badge) => (
            <li
              key={badge.id}
              className="rounded-lg border border-primary/10 bg-white px-2.5 py-1 text-xs font-semibold text-primary/80"
            >
              {badge.label}
            </li>
          ))}
        </ul>
      ) : null}

      <section className="rounded-[24px] border border-primary/10 bg-white p-5">
        <h2 className="text-lg font-bold">Publication</h2>
        <p className="mt-1 text-sm text-primary/60">
          Draft profiles remain hidden until an administrator publishes them. A
          claim or venue account is not required.
        </p>
        <div className="mt-5">
          <AdminLifecycleStatus
            isApproved={venue.is_approved}
            hasAccount={data.hasAccount}
            publicationStatus={venue.publication_status}
            onboardingStatus={venue.onboarding_status}
          />
        </div>
        <div className="mt-6 border-t border-primary/10 pt-5">
          <AdminPublicationControls
            kind="venue"
            profileId={venue.id}
            publicationStatus={venue.publication_status}
            canManage={canManageProfiles}
          />
        </div>
      </section>

      <section className="rounded-[24px] border border-primary/10 bg-white p-5">
        <h2 className="text-lg font-bold">Key fields</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Location" value={location || null} />
          <Field label="Address" value={venue.address} />
          <Field label="Website" value={venue.website} />
          <Field label="Phone" value={venue.phone} />
          <Field
            label="Courts"
            value={
              venue.courts === null
                ? null
                : `${venue.courts}${venue.court_type ? ` · ${venue.court_type}` : ""}`
            }
          />
          <Field label="Venue type" value={venue.venue_type} />
          <Field
            label="Active coaches"
            value={String(data.activeCoachCount)}
          />
          <Field
            label="Coach availability"
            value={data.hasCoachAvailability ? "Visible" : "Not visible"}
          />
          <Field
            label="Verified"
            value={venue.is_approved ? "Yes" : "No"}
          />
        </dl>
      </section>

      <section className="rounded-[24px] border border-primary/10 bg-white p-5">
        <h2 className="text-lg font-bold">Completion</h2>
        <p className="mt-1 text-sm text-primary/60">
          {completion.completedWeighted} of {completion.weightedTotal} core items
          complete
        </p>
        <ul className="mt-4 space-y-2">
          {completion.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-primary/10 px-3 py-2.5 text-sm"
            >
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
              ) : (
                <Circle className="h-4 w-4 text-primary/30" aria-hidden />
              )}
              <span className="font-semibold text-primary">{item.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[24px] border border-primary/10 bg-white p-5">
        <h2 className="text-lg font-bold">Links</h2>
        <ul className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
          <LinkChip href={`/venue/${venue.id}`} label="Public profile" external />
          {data.applicationId ? (
            <LinkChip
              href={`/admin/applications/venues/${data.applicationId}`}
              label="Application"
            />
          ) : null}
          <LinkChip
            href={`/admin/relationships?venue=${encodeURIComponent(name)}`}
            label="Relationships"
          />
          <LinkChip href="/admin/bookings" label="Bookings" />
          <LinkChip
            href={`/admin/relationships?venue=${encodeURIComponent(name)}`}
            label="Coach links"
          />
        </ul>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-primary">{value?.trim() || "—"}</dd>
    </div>
  );
}

function LinkChip({
  href,
  label,
  external,
}: {
  href: string;
  label: string;
  external?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 rounded-xl border border-primary/15 px-3 py-2 transition hover:bg-surface"
      >
        {label}
        {external ? <ExternalLink className="h-3.5 w-3.5 text-primary/45" aria-hidden /> : null}
      </Link>
    </li>
  );
}
