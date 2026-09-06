import Link from "next/link";
import WithdrawCoachApplicationButton from "@/components/account/applications/WithdrawCoachApplicationButton";
import {
  APPLICATION_STATUS_LABELS,
  AUDIENCES,
  COACH_APPLICATION_MODE_LABELS,
  COACHING_OUTCOMES,
  PLAYER_LEVELS,
  coachingRoleLabel,
  isWithdrawableApplicationStatus,
  optionLabel,
} from "@/lib/coachProfileApplication/constants";
import type { CoachApplicationWithLocations } from "@/lib/coachProfileApplication/types";

/**
 * Read-only surface for historical `claim_existing` coach applications.
 * Never renders the editable wizard.
 */
export default function CoachLegacyClaimApplication({
  data,
}: {
  data: CoachApplicationWithLocations;
}) {
  const { application, locations, targetCoach } = data;
  const statusLabel = APPLICATION_STATUS_LABELS[application.status];
  const canWithdraw = isWithdrawableApplicationStatus(application.status);
  const coachHref = application.coach_id
    ? `/account/coaches/${application.coach_id}`
    : null;

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-6 text-amber-950">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-amber-900/70">
          Legacy profile claim
        </p>
        <h2 className="mt-2 text-2xl">
          This claim is read-only
        </h2>
        <p className="mt-3 text-sm leading-6 text-amber-950/80">
          Public claiming of existing coach profiles is closed. Your historical
          claim stays visible so you can track its status
          {canWithdraw ? " or withdraw it" : ""}, but you cannot edit fields,
          change steps, or submit it.
        </p>
        <p className="mt-2 text-sm font-semibold text-amber-950/90">
          Mode and target profile are locked as{" "}
          {COACH_APPLICATION_MODE_LABELS.claim_existing}.
        </p>
      </section>

      {targetCoach ? (
        <section className="rounded-[24px] border border-primary/10 bg-surface/50 p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
            Claim target
          </p>
          <p className="mt-2 text-base font-semibold text-primary">
            {targetCoach.name || "Coach profile"}
          </p>
          <p className="mt-1 text-sm text-primary/60">
            {[targetCoach.primaryLocation, targetCoach.venueName]
              .filter(Boolean)
              .join(" · ") || "Existing listing"}
          </p>
        </section>
      ) : null}

      <section className="rounded-[24px] border border-primary/10 bg-white p-6 shadow-[0_8px_28px_rgba(3,19,34,0.04)]">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
          Application status
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h3 className="text-2xl text-primary">{statusLabel}</h3>
          <span className="rounded-full border border-primary/10 bg-surface px-3 py-1 text-xs font-semibold text-primary/70">
            Step {application.current_step} of 4
          </span>
        </div>
        {application.applicant_email ? (
          <p className="mt-3 text-sm text-primary/60">
            Stored claim email: {application.applicant_email}
          </p>
        ) : null}
        {application.review_note ? (
          <div className="mt-5 rounded-2xl border border-primary/10 bg-surface/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Review note
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-primary/75">
              {application.review_note}
            </p>
          </div>
        ) : null}
        {application.status === "approved" && coachHref ? (
          <div className="mt-5">
            <Link
              href={coachHref}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90"
            >
              Manage coach profile
            </Link>
          </div>
        ) : null}
      </section>

      <section className="rounded-[24px] border border-primary/10 bg-white p-6">
        <h3 className="text-lg text-primary">Submitted details</h3>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Detail label="Full name" value={application.full_name || "—"} />
          <Detail label="Phone" value={application.phone || "—"} />
          <Detail
            label="Role"
            value={
              coachingRoleLabel(application.coaching_role) +
              (application.coaching_role === "other" &&
              application.coaching_role_other
                ? ` — ${application.coaching_role_other}`
                : "")
            }
          />
          <Detail
            label="Experience"
            value={
              application.experience_years === null
                ? "—"
                : `${application.experience_years} years`
            }
          />
        </dl>
        <div className="mt-4 space-y-3 text-sm text-primary/80">
          <p>
            <span className="font-semibold text-primary">Levels: </span>
            {application.player_levels.length
              ? application.player_levels
                  .map((value) => optionLabel(PLAYER_LEVELS, value))
                  .join(", ")
              : "—"}
          </p>
          <p>
            <span className="font-semibold text-primary">Audiences: </span>
            {application.audiences.length
              ? application.audiences
                  .map((value) => optionLabel(AUDIENCES, value))
                  .join(", ")
              : "—"}
          </p>
          <p>
            <span className="font-semibold text-primary">Outcomes: </span>
            {application.outcomes.length
              ? application.outcomes
                  .map((value) => optionLabel(COACHING_OUTCOMES, value))
                  .join(", ")
              : "—"}
          </p>
          <p className="whitespace-pre-wrap">
            <span className="font-semibold text-primary">Introduction: </span>
            {application.description || "—"}
          </p>
        </div>
      </section>

      <section className="rounded-[24px] border border-primary/10 bg-white p-6">
        <h3 className="text-lg text-primary">Locations</h3>
        <ul className="mt-4 space-y-2 text-sm text-primary/80">
          {locations.length === 0 ? (
            <li>No locations</li>
          ) : (
            locations.map((location) => (
              <li key={location.id}>
                {location.city}, {location.country}
                {location.is_primary ? " — primary" : ""}
              </li>
            ))
          )}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/account/applications"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/15 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-surface"
        >
          Back to applications
        </Link>
        {canWithdraw ? (
          <WithdrawCoachApplicationButton applicationId={application.id} />
        ) : null}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-primary">{value}</dd>
    </div>
  );
}
