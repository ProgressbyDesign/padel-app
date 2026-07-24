import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { StartCoachApplicationButton } from "@/components/account/applications/CoachApplicationWizard";
import { StartVenueApplicationButton } from "@/components/account/applications/VenueApplicationWizard";
import {
  APPLICATION_STATUS_LABELS,
  isEditableApplicationStatus,
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

export default async function AccountApplicationsPage() {
  const [coachApplications, venueApplications] = await Promise.all([
    loadUserCoachApplications(),
    loadUserVenueApplications(),
  ]);
  const activeCoach = coachApplications.find(
    (application) =>
      application.status !== "declined" && application.status !== "withdrawn"
  );
  const latestCoach = activeCoach ?? coachApplications[0] ?? null;
  const activeVenue = venueApplications.find(
    (application) =>
      application.status !== "declined" && application.status !== "withdrawn"
  );
  const latestVenue = activeVenue ?? venueApplications[0] ?? null;

  return (
    <div className="mx-auto w-full max-w-[1680px] px-4 py-10 sm:px-6 sm:py-14 lg:px-[120px]">
      <nav aria-label="Breadcrumb">
        <Link
          href="/account"
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
          Start or continue an individual coach or venue partner application.
          Travel partner applications will appear here later.
        </p>
      </div>

      <div className="mt-10 grid max-w-5xl gap-6 lg:grid-cols-2">
        <ApplicationCard
          title="Coach application"
          emptyCopy="You have not started a coach application yet."
          href="/account/applications/coach"
          application={
            latestCoach
              ? {
                  status: APPLICATION_STATUS_LABELS[latestCoach.status],
                  currentStep: latestCoach.current_step,
                  createdAt: latestCoach.created_at,
                  submittedAt: latestCoach.submitted_at,
                  editable: isEditableApplicationStatus(latestCoach.status),
                  closed:
                    latestCoach.status === "declined" ||
                    latestCoach.status === "withdrawn",
                  reviewNote: latestCoach.review_note,
                  approvedHref:
                    latestCoach.status === "approved" && latestCoach.coach_id
                      ? `/account/coaches/${latestCoach.coach_id}`
                      : null,
                }
              : null
          }
          startButton={<StartCoachApplicationButton />}
        />
        <ApplicationCard
          title="Venue application"
          emptyCopy="You have not started a venue application yet."
          href="/account/applications/venue"
          application={
            latestVenue
              ? {
                  status:
                    VENUE_APPLICATION_STATUS_LABELS[latestVenue.status],
                  currentStep: latestVenue.current_step,
                  createdAt: latestVenue.created_at,
                  submittedAt: latestVenue.submitted_at,
                  editable: isEditableVenueApplicationStatus(
                    latestVenue.status
                  ),
                  closed:
                    latestVenue.status === "declined" ||
                    latestVenue.status === "withdrawn",
                  reviewNote: latestVenue.review_note,
                  approvedHref:
                    latestVenue.status === "approved" &&
                    latestVenue.approved_venue_id
                      ? `/account/venues/${latestVenue.approved_venue_id}`
                      : null,
                }
              : null
          }
          startButton={<StartVenueApplicationButton />}
        />
      </div>
    </div>
  );
}

type ApplicationSummary = {
  status: string;
  currentStep: number;
  createdAt: string;
  submittedAt: string | null;
  editable: boolean;
  closed: boolean;
  reviewNote: string | null;
  approvedHref: string | null;
};

function ApplicationCard({
  title,
  emptyCopy,
  href,
  application,
  startButton,
}: {
  title: string;
  emptyCopy: string;
  href: string;
  application: ApplicationSummary | null;
  startButton: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-primary/10 bg-white p-6 shadow-[0_8px_28px_rgba(3,19,34,0.04)]">
      <h2 className="text-xl font-bold text-primary">{title}</h2>

      {!application ? (
        <div className="mt-4">
          <p className="text-sm leading-6 text-primary/65">{emptyCopy}</p>
          <div className="mt-5">{startButton}</div>
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
            <Link
              href={application.approvedHref ?? href}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90"
            >
              {application.approvedHref
                ? "Manage approved profile"
                : application.editable
                ? "Continue application"
                : "View application"}
            </Link>
            {application.closed ? startButton : null}
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
