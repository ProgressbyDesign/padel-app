import Link from "next/link";
import { notFound } from "next/navigation";
import CoachApplicationReviewCards from "@/components/admin/CoachApplicationReviewCards";
import { accountHasPermission, getAdminAccount } from "@/lib/auth/adminSession";
import {
  APPLICATION_STATUS_LABELS,
  COACH_APPLICATION_MODE_LABELS,
} from "@/lib/coachProfileApplication/constants";
import { getCoachApplicationDetail } from "@/lib/admin/applicationQueries";
import { beginCoachApplicationReviewOnOpen } from "@/lib/admin/coachApplicationReview";

export default async function CoachApplicationDetailPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const detail = await getCoachApplicationDetail(applicationId);
  if (!detail) notFound();
  const { locations, targetCoach } = detail;
  // Opening the full review page starts the review (submitted → under review).
  const application = await beginCoachApplicationReviewOnOpen(
    detail.application,
  );
  const canReview = accountHasPermission(
    await getAdminAccount(),
    "applications.review",
  );
  const isClaim = application.application_mode === "claim_existing";

  return (
    <div>
      <Link
        href="/admin/applications/coaches"
        className="text-sm font-semibold text-primary/55 hover:text-primary"
      >
        ← Coach queue
      </Link>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
            {isClaim ? "Coach profile claim" : "New coach application"}
          </p>
          <h1 className="mt-2">
            {application.full_name || "Unnamed applicant"}
          </h1>
          <p className="mt-2 break-all text-xs text-primary/45">
            {application.id}
          </p>
        </div>
        <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-accent">
          {APPLICATION_STATUS_LABELS[application.status]}
        </span>
      </div>

      <CoachApplicationReviewCards
        application={application}
        locations={locations}
        targetCoach={targetCoach}
        canReview={canReview}
        beforeCards={
          <>
            {application.review_note ? (
              <Section title="Current review note">
                <p className="whitespace-pre-wrap text-sm leading-6 text-primary/75">
                  {application.review_note}
                </p>
              </Section>
            ) : null}
            <Section title="Request details">
              <dl className="grid gap-5 sm:grid-cols-2">
                <Detail
                  label="Application type"
                  value={
                    COACH_APPLICATION_MODE_LABELS[application.application_mode]
                  }
                />
                <Detail
                  label="Applicant user ID"
                  value={application.user_id}
                  mono
                />
              </dl>
            </Section>
            {isClaim ? (
              <Section title="Existing profile (read-only)">
                <p className="mb-4 text-sm text-primary/60">
                  The cards below contain the reviewed proposal. Editing them
                  does not change this existing coach.
                </p>
                <dl className="grid gap-5 sm:grid-cols-2">
                  <Detail label="Name" value={targetCoach?.name} />
                  <Detail label="Role" value={targetCoach?.role} />
                  <Detail
                    label="Location"
                    value={targetCoach?.primaryLocation}
                  />
                  <Detail label="Venue" value={targetCoach?.venueName} />
                  <Detail
                    label="Claimed status"
                    value={
                      targetCoach
                        ? targetCoach.is_claimed
                          ? "Already claimed"
                          : "Unclaimed"
                        : null
                    }
                  />
                  <Detail
                    label="Target coach ID"
                    value={application.target_coach_id}
                    mono
                  />
                </dl>
              </Section>
            ) : null}
          </>
        }
        afterCards={
          <Section title="Application record">
            <dl className="grid gap-5 sm:grid-cols-2">
              <Detail
                label="Current step"
                value={`${application.current_step} of 4`}
              />
              <Detail
                label="Created"
                value={formatDate(application.created_at)}
              />
              <Detail
                label="Updated"
                value={formatDate(application.updated_at)}
              />
              <Detail
                label="Submitted"
                value={formatDate(application.submitted_at)}
              />
              <Detail
                label="Terms accepted"
                value={formatDate(application.terms_accepted_at)}
              />
              <Detail
                label="Privacy accepted"
                value={formatDate(application.privacy_accepted_at)}
              />
              <Detail
                label="Reviewed"
                value={formatDate(application.reviewed_at)}
              />
              <Detail
                label="Reviewer user ID"
                value={application.reviewed_by_user_id}
                mono
              />
              <Detail label="Coach ID" value={application.coach_id} mono />
            </dl>
            {application.coach_id ? (
              <Link
                href={`/account/coaches/${application.coach_id}`}
                className="mt-5 inline-flex min-h-10 items-center rounded-xl border border-primary/15 px-4 text-sm font-semibold"
              >
                Open approved coach
              </Link>
            ) : null}
          </Section>
        }
      />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-primary/10 bg-white p-5 sm:p-6">
      <h2 className="text-xl">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Detail({
  label,
  value,
  mono = false,
  multiline = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  multiline?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-primary/40">
        {label}
      </dt>
      <dd
        className={`mt-1.5 text-sm leading-6 text-primary/75 ${mono ? "break-all font-mono text-xs" : ""} ${multiline ? "whitespace-pre-wrap" : ""}`}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

function formatDate(value: string | null): string | null {
  return value
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;
}
