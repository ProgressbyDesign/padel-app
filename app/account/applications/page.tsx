import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { StartCoachApplicationButton } from "@/components/account/applications/CoachApplicationWizard";
import { StartVenueApplicationButton } from "@/components/account/applications/VenueApplicationWizard";
import {
  APPLICATION_STATUS_LABELS,
  isActiveApplicationStatus,
  isEditableApplicationStatus,
  isHistoryApplicationStatus,
} from "@/lib/coachProfileApplication/constants";
import { loadUserCoachApplications } from "@/lib/queries/coachProfileApplication";
import { loadUserVenueApplications } from "@/lib/queries/venueProfileApplication";
import {
  VENUE_APPLICATION_STATUS_LABELS,
  isEditableVenueApplicationStatus,
} from "@/lib/venueProfileApplication/constants";

export const metadata: Metadata = {
  title: "Applications",
  description: "Track your Padel Pathways partner applications.",
};

const ACTIVE_VENUE = [
  "draft",
  "submitted",
  "under_review",
  "changes_requested",
] as const;

const HISTORY_VENUE = ["approved", "declined", "withdrawn"] as const;

export default async function AccountApplicationsPage() {
  const [coachApplications, venueApplications] = await Promise.all([
    loadUserCoachApplications(),
    loadUserVenueApplications(),
  ]);

  const activeCoach = coachApplications.filter((application) =>
    isActiveApplicationStatus(application.status)
  );
  const historyCoach = coachApplications.filter((application) =>
    isHistoryApplicationStatus(application.status)
  );
  const activeVenue = venueApplications.filter((application) =>
    (ACTIVE_VENUE as readonly string[]).includes(application.status)
  );
  const historyVenue = venueApplications.filter((application) =>
    (HISTORY_VENUE as readonly string[]).includes(application.status)
  );

  return (
    <div className="mx-auto w-full max-w-[1680px] px-4 py-10 sm:px-6 sm:py-14 lg:px-[120px]">
      <nav aria-label="Breadcrumb">
        <Link
          href="/account/personal"
          className="text-sm font-semibold text-primary/60 transition hover:text-primary"
        >
          ← Back to account
        </Link>
      </nav>

      <div className="mt-6 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
          Applications
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-primary sm:text-4xl">
          Partner applications
        </h1>
        <p className="mt-3 text-base leading-6 text-primary/65">
          Active applications appear here until they are decided. Approved
          profiles are managed from your account dashboards.
        </p>
      </div>

      <section className="mt-10" aria-labelledby="active-applications-heading">
        <h2
          id="active-applications-heading"
          className="text-2xl font-bold text-primary"
        >
          Active applications
        </h2>
        <div className="mt-5 grid max-w-5xl gap-6 lg:grid-cols-2">
          <ApplicationCard
            title="Coach application"
            emptyCopy="You do not have an active coach application."
            href="/account/applications/coach"
            application={
              activeCoach[0]
                ? toCoachSummary(activeCoach[0])
                : null
            }
            startButton={<StartCoachApplicationButton />}
            showStartWhenEmpty
          />
          <ApplicationCard
            title="Venue application"
            emptyCopy="You do not have an active venue application."
            href="/account/applications/venue"
            application={
              activeVenue[0]
                ? toVenueSummary(activeVenue[0])
                : null
            }
            startButton={<StartVenueApplicationButton />}
            showStartWhenEmpty
          />
        </div>
      </section>

      {(historyCoach.length > 0 || historyVenue.length > 0) ? (
        <section className="mt-12" aria-labelledby="history-applications-heading">
          <h2
            id="history-applications-heading"
            className="text-2xl font-bold text-primary"
          >
            Application history
          </h2>
          <div className="mt-5 grid max-w-5xl gap-6 lg:grid-cols-2">
            {historyCoach.map((application) => (
              <ApplicationCard
                key={`coach-history-${application.id}`}
                title="Coach application"
                emptyCopy=""
                href="/account/applications/coach"
                application={toCoachSummary(application)}
                startButton={null}
                showStartWhenEmpty={false}
                history
              />
            ))}
            {historyVenue.map((application) => (
              <ApplicationCard
                key={`venue-history-${application.id}`}
                title="Venue application"
                emptyCopy=""
                href="/account/applications/venue"
                application={toVenueSummary(application)}
                startButton={null}
                showStartWhenEmpty={false}
                history
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

type ApplicationSummary = {
  status: string;
  statusKey: string;
  currentStep: number;
  createdAt: string;
  submittedAt: string | null;
  editable: boolean;
  reviewNote: string | null;
  manageHref: string | null;
};

function toCoachSummary(
  application: Awaited<ReturnType<typeof loadUserCoachApplications>>[number]
): ApplicationSummary {
  return {
    status: APPLICATION_STATUS_LABELS[application.status],
    statusKey: application.status,
    currentStep: application.current_step,
    createdAt: application.created_at,
    submittedAt: application.submitted_at,
    editable: isEditableApplicationStatus(application.status),
    reviewNote: application.review_note,
    manageHref:
      application.status === "approved" && application.coach_id
        ? `/account/coaches/${application.coach_id}`
        : null,
  };
}

function toVenueSummary(
  application: Awaited<ReturnType<typeof loadUserVenueApplications>>[number]
): ApplicationSummary {
  return {
    status: VENUE_APPLICATION_STATUS_LABELS[application.status],
    statusKey: application.status,
    currentStep: application.current_step,
    createdAt: application.created_at,
    submittedAt: application.submitted_at,
    editable: isEditableVenueApplicationStatus(application.status),
    reviewNote: application.review_note,
    manageHref:
      application.status === "approved" && application.approved_venue_id
        ? `/account/venues/${application.approved_venue_id}`
        : null,
  };
}

function ApplicationCard({
  title,
  emptyCopy,
  href,
  application,
  startButton,
  showStartWhenEmpty,
  history = false,
}: {
  title: string;
  emptyCopy: string;
  href: string;
  application: ApplicationSummary | null;
  startButton: ReactNode;
  showStartWhenEmpty: boolean;
  history?: boolean;
}) {
  return (
    <section className="rounded-[24px] border border-primary/10 bg-white p-6 shadow-[0_8px_28px_rgba(3,19,34,0.04)]">
      <h3 className="text-xl font-bold text-primary">{title}</h3>
      {history ? (
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary/40">
          History
        </p>
      ) : null}

      {!application ? (
        <div className="mt-4">
          <p className="text-sm leading-6 text-primary/65">{emptyCopy}</p>
          {showStartWhenEmpty ? (
            <div className="mt-5">{startButton}</div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <SummaryDetail label="Status" value={application.status} strong />
            <SummaryDetail
              label="Progress"
              value={`Step ${application.currentStep} of 4`}
              strong
            />
            <SummaryDetail
              label="Created"
              value={new Date(application.createdAt).toLocaleDateString()}
            />
            <SummaryDetail
              label="Submitted"
              value={
                application.submittedAt
                  ? new Date(application.submittedAt).toLocaleDateString()
                  : "Not yet"
              }
            />
          </dl>

          {application.reviewNote ? (
            <div className="rounded-xl bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-amber-800/70">
                Review note
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-amber-950">
                {application.reviewNote}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            {application.manageHref ? (
              <Link
                href={application.manageHref}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90"
              >
                Manage profile
              </Link>
            ) : (
              <Link
                href={href}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90"
              >
                {application.editable
                  ? "Continue application"
                  : "View application"}
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function SummaryDetail({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
        {label}
      </dt>
      <dd
        className={`mt-1 text-sm ${
          strong ? "font-semibold text-primary" : "text-primary/75"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
