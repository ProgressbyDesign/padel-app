import type { Metadata } from "next";
import Link from "next/link";
import { StartCoachApplicationButton } from "@/components/account/applications/CoachApplicationWizard";
import {
  APPLICATION_STATUS_LABELS,
  isEditableApplicationStatus,
} from "@/lib/coachProfileApplication/constants";
import { loadUserCoachApplications } from "@/lib/queries/coachProfileApplication";

export const metadata: Metadata = {
  title: "Applications",
  description: "Track your Padel Pathways partner applications.",
};

export default async function AccountApplicationsPage() {
  const applications = await loadUserCoachApplications();
  const active = applications.find(
    (application) =>
      application.status !== "declined" && application.status !== "withdrawn"
  );
  const latest = active ?? applications[0] ?? null;

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
          Start or continue your individual coach application. Academy and travel
          partner flows will appear here later.
        </p>
      </div>

      <section className="mt-10 max-w-2xl rounded-[24px] border border-primary/10 bg-white p-6 shadow-[0_8px_28px_rgba(3,19,34,0.04)]">
        <h2 className="text-xl font-bold text-primary">Coach application</h2>

        {!latest ? (
          <div className="mt-4">
            <p className="text-sm leading-6 text-primary/65">
              You have not started a coach application yet.
            </p>
            <div className="mt-5">
              <StartCoachApplicationButton />
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
                  Status
                </dt>
                <dd className="mt-1 text-sm font-semibold text-primary">
                  {APPLICATION_STATUS_LABELS[latest.status]}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
                  Progress
                </dt>
                <dd className="mt-1 text-sm font-semibold text-primary">
                  Step {latest.current_step} of 4
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
                  Created
                </dt>
                <dd className="mt-1 text-sm text-primary/75">
                  {new Date(latest.created_at).toLocaleDateString()}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
                  Submitted
                </dt>
                <dd className="mt-1 text-sm text-primary/75">
                  {latest.submitted_at
                    ? new Date(latest.submitted_at).toLocaleDateString()
                    : "Not yet"}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-3">
              {isEditableApplicationStatus(latest.status) ? (
                <Link
                  href="/account/applications/coach"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90"
                >
                  Continue application
                </Link>
              ) : (
                <Link
                  href="/account/applications/coach"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90"
                >
                  View application
                </Link>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
