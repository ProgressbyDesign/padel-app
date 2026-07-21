import Link from "next/link";
import AccountHeader from "@/components/account/AccountHeader";
import EmptyAccountState from "@/components/account/EmptyAccountState";
import ManagedListingCard from "@/components/account/ManagedListingCard";
import {
  APPLICATION_STATUS_LABELS,
  isEditableApplicationStatus,
} from "@/lib/coachProfileApplication/constants";
import { loadAccountDashboard } from "@/lib/queries/accountDashboard";

export default async function AccountPage() {
  const data = await loadAccountDashboard();
  const hasMemberships = data.coaches.length > 0 || data.venues.length > 0;
  const application = data.coachApplication;

  return (
    <div className="mx-auto w-full max-w-[1680px] px-4 py-10 sm:px-6 sm:py-14 lg:px-[120px]">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
          Account dashboard
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-primary sm:text-4xl">
          Welcome{data.account.fullName ? `, ${data.account.fullName}` : ""}
        </h1>
        <p className="mt-3 text-base leading-6 text-primary/65">
          Manage applications, coach profiles, and venues connected to your account.
        </p>
      </div>

      <div className="mt-8">
        <AccountHeader email={data.account.email} />
      </div>

      <section className="mt-10" aria-labelledby="applications-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="applications-heading" className="text-2xl font-bold text-primary">
              Applications
            </h2>
            <p className="mt-1 text-sm text-primary/60">
              Partner applications started from your account.
            </p>
          </div>
          <Link
            href="/account/applications"
            className="text-sm font-semibold text-primary/70 transition hover:text-primary"
          >
            View all
          </Link>
        </div>

        <div className="mt-5 max-w-xl rounded-[20px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)]">
          {!application ? (
            <div>
              <h3 className="text-lg font-bold text-primary">Coach application</h3>
              <p className="mt-2 text-sm text-primary/65">
                Start a short authenticated application to join as an individual coach.
              </p>
              <Link
                href="/account/applications/coach"
                className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:bg-primary/90"
              >
                Start coach application
              </Link>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-bold text-primary">
                {isEditableApplicationStatus(application.status)
                  ? "Continue coach application"
                  : application.status === "submitted" ||
                      application.status === "under_review"
                    ? "Coach application submitted"
                    : "Coach application"}
              </h3>
              <p className="mt-2 text-sm text-primary/65">
                Status: {APPLICATION_STATUS_LABELS[application.status]} · Step{" "}
                {application.currentStep} of 4
              </p>
              <Link
                href="/account/applications/coach"
                className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:bg-primary/90"
              >
                {isEditableApplicationStatus(application.status)
                  ? "Continue application"
                  : "View application"}
              </Link>
            </div>
          )}
        </div>
      </section>

      {!hasMemberships ? (
        <div className="mt-8">
          <EmptyAccountState />
        </div>
      ) : null}

      {data.coaches.length > 0 ? (
        <section className="mt-10" aria-labelledby="managed-coaches-heading">
          <div>
            <h2 id="managed-coaches-heading" className="text-2xl font-bold text-primary">
              My coach profiles
            </h2>
            <p className="mt-1 text-sm text-primary/60">
              Profiles connected through your coach memberships.
            </p>
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {data.coaches.map((coach) => (
              <ManagedListingCard
                key={coach.id}
                kind="coach"
                id={coach.id}
                name={coach.name}
                membershipRole={coach.membershipRole}
                publicHref={`/coach/${encodeURIComponent(coach.id)}`}
              />
            ))}
          </div>
        </section>
      ) : null}

      {data.venues.length > 0 ? (
        <section className="mt-10" aria-labelledby="managed-venues-heading">
          <div>
            <h2 id="managed-venues-heading" className="text-2xl font-bold text-primary">
              My venues
            </h2>
            <p className="mt-1 text-sm text-primary/60">
              Venues connected through your venue memberships.
            </p>
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {data.venues.map((venue) => (
              <ManagedListingCard
                key={venue.id}
                kind="venue"
                id={venue.id}
                name={venue.name}
                location={venue.location}
                membershipRole={venue.membershipRole}
                publicHref={`/venue/${encodeURIComponent(venue.id)}`}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
