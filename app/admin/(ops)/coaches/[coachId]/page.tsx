import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { AdminLifecycleStatus } from "@/components/admin/AdminLifecycleStatus";
import { AdminPublicationControls } from "@/components/admin/AdminPublicationControls";
import { loadOpsCoachOverview } from "@/lib/admin/opsProfileQueries";
import {
  accountHasPermission,
  requireAdminPermission,
} from "@/lib/auth/adminSession";
import { coachOutcomeLabel } from "@/lib/coachManagement";
import { optionLabel, PLAYER_LEVELS } from "@/lib/coachProfileApplication/constants";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ coachId: string }>;
};

export default async function OpsCoachOverviewPage({ params }: PageProps) {
  const { coachId } = await params;
  const admin = await requireAdminPermission("profiles.read", "not-found");
  const data = await loadOpsCoachOverview(coachId);
  if (!data) notFound();

  const { coach, completion } = data;
  const name = coach.name?.trim() || "Coach";
  const canManageProfiles = accountHasPermission(admin, "profiles.manage");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/coaches"
          className="text-sm font-semibold text-primary/60 hover:text-primary"
        >
          ← Coaches
        </Link>
        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
          Ops · Coach profile
        </p>
        <h1 className="mt-2">{name}</h1>
        <p className="mt-1 break-all text-xs text-primary/45">{coach.id}</p>
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
        <h2 className="text-lg">Publication</h2>
        <p className="mt-1 text-sm text-primary/60">
          Draft profiles remain hidden until an administrator publishes them. A
          claim or coach account is not required.
        </p>
        <div className="mt-5">
          <AdminLifecycleStatus
            isApproved={coach.is_approved}
            hasAccount={data.hasAccount}
            publicationStatus={coach.publication_status}
            onboardingStatus={coach.onboarding_status}
          />
        </div>
        <div className="mt-6 border-t border-primary/10 pt-5">
          <AdminPublicationControls
            kind="coach"
            profileId={coach.id}
            publicationStatus={coach.publication_status}
            canManage={canManageProfiles}
          />
        </div>
      </section>

      <section className="rounded-[24px] border border-primary/10 bg-white p-5">
        <h2 className="text-lg">Key fields</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Role" value={coach.role} />
          <Field label="Primary location" value={data.primaryLocation} />
          <Field
            label="Experience"
            value={
              coach.experience_years === null
                ? null
                : `${coach.experience_years} years`
            }
          />
          <Field label="Phone" value={coach.phone} />
          <Field label="Email" value={coach.email} />
          <Field
            label="Price from"
            value={coach.price_from === null ? null : String(coach.price_from)}
          />
          <Field
            label="Player levels"
            value={
              data.playerLevels.length
                ? data.playerLevels
                    .map((value) => optionLabel(PLAYER_LEVELS, value))
                    .join(", ")
                : null
            }
          />
          <Field
            label="Outcomes"
            value={
              data.outcomes.length
                ? data.outcomes.map((value) => coachOutcomeLabel(value)).join(", ")
                : null
            }
          />
          <Field
            label="Audience"
            value={
              [
                data.audienceAdults ? "Adults" : null,
                data.audienceJuniors ? "Juniors" : null,
              ]
                .filter(Boolean)
                .join(", ") || null
            }
          />
          <Field
            label="Availability"
            value={data.availabilityLive ? "Live" : "Not live"}
          />
          <Field
            label="Pending bookings"
            value={String(data.pendingBookingCount)}
          />
        </dl>
        {coach.description?.trim() ? (
          <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-primary/70">
            {coach.description.trim()}
          </p>
        ) : null}
      </section>

      <section className="rounded-[24px] border border-primary/10 bg-white p-5">
        <h2 className="text-lg">Completion</h2>
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
        <h2 className="text-lg">Links</h2>
        <ul className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
          <LinkChip href={`/coach/${coach.id}`} label="Public profile" external />
          {data.applicationId ? (
            <LinkChip
              href={`/admin/applications/coaches/${data.applicationId}`}
              label="Application"
            />
          ) : null}
          <LinkChip
            href={`/admin/relationships?coach=${encodeURIComponent(name)}`}
            label="Relationships"
          />
          <LinkChip href="/admin/bookings" label="Bookings" />
          <LinkChip
            href={`/account/coaches/${coach.id}/availability`}
            label="Availability (account)"
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
