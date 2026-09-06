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

export default function CoachApplicationReadOnly({
  data,
  verifiedEmail,
}: {
  data: CoachApplicationWithLocations;
  verifiedEmail: string;
}) {
  const { application, locations, targetCoach } = data;
  const statusLabel = APPLICATION_STATUS_LABELS[application.status];
  const coachHref = application.coach_id
    ? `/account/coaches/${application.coach_id}`
    : null;
  const isClaim = application.application_mode === "claim_existing";
  const canWithdraw = isWithdrawableApplicationStatus(application.status);

  const statusCopy =
    application.status === "submitted" || application.status === "under_review"
      ? isClaim
        ? "Your profile claim is with our team. Editing is locked until review finishes — we email updates to your verified address."
        : "Your application is with our team. Editing is locked until review finishes — we email updates to your verified address."
      : application.status === "approved"
        ? isClaim
          ? "Approved. You can manage the claimed coach profile from your account."
          : "Approved. Your coach profile was seeded from this application. Finish images, venues, and availability on your profile."
        : application.status === "declined"
          ? isClaim
            ? "This profile claim was declined. Contact Padel Pathways if you need guidance on next steps."
            : "This application was declined. Contact Padel Pathways if you need guidance on next steps."
          : application.status === "withdrawn"
            ? "This application was withdrawn."
            : application.status === "changes_requested"
              ? "Changes were requested. Open the editable draft from Applications to update and resubmit."
              : "This application is currently read-only.";

  return (
    <div className="space-y-6">
      {isClaim && targetCoach ? (
        <section className="rounded-[24px] border border-primary/10 bg-surface/50 p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
            {COACH_APPLICATION_MODE_LABELS.claim_existing}
          </p>
          <p className="mt-2 text-base font-semibold text-primary">
            Claiming {targetCoach.name || "coach profile"}
          </p>
          <p className="mt-1 text-sm text-primary/60">
            {[targetCoach.primaryLocation, targetCoach.venueName]
              .filter(Boolean)
              .join(" · ") || "Existing public profile"}
          </p>
        </section>
      ) : null}

      <section className="rounded-[24px] border border-primary/10 bg-white p-6 shadow-[0_8px_28px_rgba(3,19,34,0.04)]">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
          Application status
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h2 className="text-2xl text-primary">{statusLabel}</h2>
          <span className="rounded-full border border-primary/10 bg-surface px-3 py-1 text-xs font-semibold text-primary/70">
            Step {application.current_step} of 4
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-primary/65">{statusCopy}</p>
        {application.submitted_at ? (
          <p className="mt-2 text-sm text-primary/55">
            Submitted{" "}
            {new Date(application.submitted_at).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        ) : application.status === "submitted" ||
          application.status === "under_review" ? (
          <p className="mt-2 text-sm text-primary/55">Submitted for review</p>
        ) : null}
        {application.reviewed_at ? (
          <p className="mt-2 text-sm text-primary/55">
            Reviewed{" "}
            {new Date(application.reviewed_at).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
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
        <h3 className="text-lg text-primary">About you</h3>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Full name
            </dt>
            <dd className="mt-1 text-sm text-primary">
              {application.full_name || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Email
            </dt>
            <dd className="mt-1 text-sm text-primary">{verifiedEmail || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Phone
            </dt>
            <dd className="mt-1 text-sm text-primary">{application.phone || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Role
            </dt>
            <dd className="mt-1 text-sm text-primary">
              {coachingRoleLabel(application.coaching_role)}
              {application.coaching_role === "other" &&
              application.coaching_role_other
                ? ` — ${application.coaching_role_other}`
                : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
              Experience
            </dt>
            <dd className="mt-1 text-sm text-primary">
              {application.experience_years === null
                ? "—"
                : `${application.experience_years} years`}
            </dd>
          </div>
        </dl>
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

      <section className="rounded-[24px] border border-primary/10 bg-white p-6">
        <h3 className="text-lg text-primary">Coaching</h3>
        <div className="mt-4 space-y-4 text-sm text-primary/80">
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
