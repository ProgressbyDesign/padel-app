import Link from "next/link";
import WithdrawCoachApplicationButton from "@/components/account/applications/WithdrawCoachApplicationButton";
import {
  APPLICATION_STATUS_LABELS,
  COACH_APPLICATION_MODE_LABELS,
  isWithdrawableApplicationStatus,
} from "@/lib/coachProfileApplication/constants";
import type { CoachApplicationWithLocations } from "@/lib/coachProfileApplication/types";

export default function CoachApplicationClaimConflict({
  current,
  intendedClaimHref,
}: {
  current: CoachApplicationWithLocations;
  intendedClaimHref: string | null;
}) {
  const { application, targetCoach } = current;
  const canWithdraw = isWithdrawableApplicationStatus(application.status);

  return (
    <section className="rounded-[24px] border border-amber-200 bg-amber-50/80 p-6 sm:p-8">
      <h2 className="text-2xl text-amber-950">
        You already have a coach application in progress
      </h2>
      <p className="mt-3 text-sm leading-6 text-amber-950/80">
        You can only have one active coach application at a time. Review your
        current application, or withdraw it before applying for a different
        profile.
      </p>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-amber-900/55">
            Application type
          </dt>
          <dd className="mt-1 text-sm font-semibold text-amber-950">
            {COACH_APPLICATION_MODE_LABELS[application.application_mode]}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-amber-900/55">
            Status
          </dt>
          <dd className="mt-1 text-sm font-semibold text-amber-950">
            {APPLICATION_STATUS_LABELS[application.status]}
          </dd>
        </div>
        {application.application_mode === "claim_existing" ? (
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-amber-900/55">
              Current target coach
            </dt>
            <dd className="mt-1 text-sm font-semibold text-amber-950">
              {targetCoach?.name || application.full_name || "Coach profile"}
              {targetCoach?.primaryLocation
                ? ` · ${targetCoach.primaryLocation}`
                : ""}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/account/applications/coach"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent"
        >
          Review current application
        </Link>
        {canWithdraw ? (
          <WithdrawCoachApplicationButton
            applicationId={application.id}
            nextPath={intendedClaimHref}
          />
        ) : null}
        <Link
          href="/contact"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-300 bg-white px-5 py-2.5 text-sm font-semibold text-amber-950"
        >
          Contact customer support
        </Link>
      </div>
    </section>
  );
}

export function CoachApplicationApprovedNotice({
  coachId,
}: {
  coachId: string | null;
}) {
  return (
    <section className="rounded-[24px] border border-emerald-200 bg-emerald-50/80 p-6 sm:p-8">
      <h2 className="text-2xl text-emerald-950">
        You already manage a coach profile
      </h2>
      <p className="mt-3 text-sm leading-6 text-emerald-900/80">
        Your coach application has been approved. Contact customer support if
        you believe you need to claim or create a different coach profile.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        {coachId ? (
          <Link
            href={`/account/coaches/${coachId}`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent"
          >
            Manage coach profile
          </Link>
        ) : null}
        <Link
          href="/contact"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-300 bg-white px-5 py-2.5 text-sm font-semibold text-emerald-950"
        >
          Contact customer support
        </Link>
      </div>
    </section>
  );
}
