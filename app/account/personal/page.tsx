import Link from "next/link";
import AccountHeader from "@/components/account/AccountHeader";
import EmptyAccountState from "@/components/account/EmptyAccountState";
import {
  ManagedCoachWorkspaceCard,
  ManagedVenueWorkspaceCard,
} from "@/components/account/ManagedWorkspaceCard";
import { buildPersonalDashboardView } from "@/lib/account/personalDashboard";
import {
  APPLICATION_STATUS_LABELS,
  isEditableApplicationStatus,
} from "@/lib/coachProfileApplication/constants";
import { loadAccountDashboard } from "@/lib/queries/accountDashboard";
import {
  VENUE_APPLICATION_STATUS_LABELS,
  isEditableVenueApplicationStatus,
} from "@/lib/venueProfileApplication/constants";

export default async function PersonalAccountPage() {
  const data = await loadAccountDashboard();
  const view = buildPersonalDashboardView(data);
  const coachApplication = data.coachApplication;
  const venueApplication = data.venueApplication;

  const hasRelationshipAttention = data.relationshipAttention.items.length > 0;
  const hasPlayerBookingAttention =
    data.bookingAttention.playerAwaiting > 0 ||
    data.bookingAttention.playerAcceptedUpcoming > 0;
  const coachPendingFromWorkspaces = data.coaches.filter(
    (coach) => coach.pendingBookingCount > 0
  );
  const hasAttention =
    hasRelationshipAttention ||
    hasPlayerBookingAttention ||
    coachPendingFromWorkspaces.length > 0;

  return (
    <div className="mx-auto w-full max-w-[1680px] px-4 py-10 sm:px-6 sm:py-14 lg:px-[120px]">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
          {view.isPurePlayer ? "Player workspace" : "Personal workspace"}
        </p>
        <h1 className="mt-3 text-3xl text-primary sm:text-4xl">
          Welcome{data.account.fullName ? `, ${data.account.fullName}` : ""}
        </h1>
        <p className="mt-3 text-base leading-6 text-primary/65">
          {view.isPurePlayer
            ? "Find coaches, manage your bookings, and keep your account up to date."
            : "Your sessions, applications, and managed profiles in one place."}
        </p>
      </div>

      <div className="mt-8">
        <AccountHeader email={data.account.email} />
      </div>

      {view.showManagedCoaches ? (
        <section className="mt-10" aria-labelledby="managed-coaches-heading">
          <div>
            <h2
              id="managed-coaches-heading"
              className="text-2xl text-primary"
            >
              My coach workspaces
            </h2>
            <p className="mt-1 text-sm text-primary/60">
              Open a coach dashboard to manage profile, availability, and
              bookings.
            </p>
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {data.coaches.map((coach) => (
              <ManagedCoachWorkspaceCard key={coach.id} coach={coach} />
            ))}
          </div>
        </section>
      ) : null}

      {view.showManagedVenues ? (
        <section className="mt-10" aria-labelledby="managed-venues-heading">
          <div>
            <h2
              id="managed-venues-heading"
              className="text-2xl text-primary"
            >
              My venue workspaces
            </h2>
            <p className="mt-1 text-sm text-primary/60">
              Open a venue dashboard to manage listing details and coach links.
            </p>
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {data.venues.map((venue) => (
              <ManagedVenueWorkspaceCard key={venue.id} venue={venue} />
            ))}
          </div>
        </section>
      ) : null}

      {view.showPlayerEmptyState ? (
        <div className="mt-8">
          <EmptyAccountState />
        </div>
      ) : null}

      {view.showPlayerCtas ? (
        <section className="mt-10" aria-labelledby="player-actions-heading">
          <h2 id="player-actions-heading" className="text-2xl text-primary">
            Your player tools
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {view.playerCtas.map((cta) => (
              <Link
                key={cta.href}
                href={cta.href}
                className="rounded-[20px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] transition hover:border-primary/20"
              >
                <h3 className="text-lg text-primary">{cta.title}</h3>
                <p className="mt-2 text-sm leading-6 text-primary/65">
                  {cta.description}
                </p>
                <span className="mt-4 inline-flex text-sm font-semibold text-primary">
                  Open →
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {hasAttention ? (
        <section className="mt-10" aria-labelledby="attention-heading">
          <div>
            <h2 id="attention-heading" className="text-2xl text-primary">
              Needs attention
            </h2>
            <p className="mt-1 text-sm text-primary/60">
              Relationship updates and booking items that need a response.
            </p>
          </div>
          <ul className="mt-5 space-y-3">
            {data.relationshipAttention.items.map((item) => (
              <li
                key={`${item.kind}-${item.entityId}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-amber-200 bg-amber-50/80 px-5 py-4"
              >
                <div>
                  <p className="font-semibold text-amber-950">{item.entityName}</p>
                  <p className="mt-1 text-sm text-amber-900/80">{item.message}</p>
                </div>
                <Link
                  href={item.href}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:bg-primary/90"
                >
                  Review
                </Link>
              </li>
            ))}

            {data.bookingAttention.playerAwaiting > 0 ? (
              <li className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-amber-200 bg-amber-50/80 px-5 py-4">
                <div>
                  <p className="font-semibold text-amber-950">
                    Awaiting coach response
                  </p>
                  <p className="mt-1 text-sm text-amber-900/80">
                    {data.bookingAttention.playerAwaiting === 1
                      ? "1 booking request is waiting for a coach reply."
                      : `${data.bookingAttention.playerAwaiting} booking requests are waiting for a coach reply.`}
                  </p>
                </div>
                <Link
                  href="/account/bookings"
                  className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent"
                >
                  Review
                </Link>
              </li>
            ) : null}

            {data.bookingAttention.playerAcceptedUpcoming > 0 ? (
              <li className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-emerald-200 bg-emerald-50/80 px-5 py-4">
                <div>
                  <p className="font-semibold text-emerald-950">
                    Accepted upcoming sessions
                  </p>
                  <p className="mt-1 text-sm text-emerald-900/80">
                    {data.bookingAttention.playerAcceptedUpcoming === 1
                      ? "1 accepted session — arrange payment with the coach."
                      : `${data.bookingAttention.playerAcceptedUpcoming} accepted sessions — arrange payment with the coach.`}
                  </p>
                </div>
                <Link
                  href="/account/bookings"
                  className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent"
                >
                  View
                </Link>
              </li>
            ) : null}

            {coachPendingFromWorkspaces.map((coach) => (
              <li
                key={`coach-pending-${coach.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-amber-200 bg-amber-50/80 px-5 py-4"
              >
                <div>
                  <p className="font-semibold text-amber-950">{coach.name}</p>
                  <p className="mt-1 text-sm text-amber-900/80">
                    {coach.pendingBookingCount === 1
                      ? "1 booking request needs a response."
                      : `${coach.pendingBookingCount} booking requests need a response.`}
                  </p>
                </div>
                <Link
                  href={`/account/coaches/${encodeURIComponent(coach.id)}/bookings`}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:bg-primary/90"
                >
                  Review bookings
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {view.showApplicationsSection ? (
        <section className="mt-10" aria-labelledby="applications-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                id="applications-heading"
                className="text-2xl text-primary"
              >
                Applications
              </h2>
              <p className="mt-1 text-sm text-primary/60">
                Active partner applications. Approved profiles appear under
                managed workspaces above.
              </p>
            </div>
            <Link
              href="/account/applications"
              className="text-sm font-semibold text-primary/70 transition hover:text-primary"
            >
              View all
            </Link>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {coachApplication ? (
              <div className="rounded-[20px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)]">
                <h3 className="text-lg text-primary">
                  {isEditableApplicationStatus(coachApplication.status)
                    ? "Continue coach application"
                    : coachApplication.status === "submitted" ||
                        coachApplication.status === "under_review"
                      ? "Coach application submitted"
                      : "Coach application"}
                </h3>
                <p className="mt-2 text-sm text-primary/65">
                  Status: {APPLICATION_STATUS_LABELS[coachApplication.status]} ·
                  Step {coachApplication.currentStep} of 4
                </p>
                {coachApplication.status === "changes_requested" &&
                coachApplication.reviewNote ? (
                  <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-950">
                    {coachApplication.reviewNote}
                  </p>
                ) : null}
                <Link
                  href="/account/applications/coach"
                  className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:bg-primary/90"
                >
                  {isEditableApplicationStatus(coachApplication.status)
                    ? "Continue application"
                    : "View application"}
                </Link>
              </div>
            ) : null}

            {venueApplication ? (
              <div className="rounded-[20px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)]">
                <h3 className="text-lg text-primary">
                  {isEditableVenueApplicationStatus(venueApplication.status)
                    ? "Continue venue application"
                    : venueApplication.status === "submitted" ||
                        venueApplication.status === "under_review"
                      ? "Venue application submitted"
                      : "Venue application"}
                </h3>
                <p className="mt-2 text-sm text-primary/65">
                  Status:{" "}
                  {VENUE_APPLICATION_STATUS_LABELS[venueApplication.status]} ·
                  Step {venueApplication.currentStep} of 4
                </p>
                {venueApplication.status === "changes_requested" &&
                venueApplication.reviewNote ? (
                  <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-950">
                    {venueApplication.reviewNote}
                  </p>
                ) : null}
                <Link
                  href="/account/applications/venue"
                  className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:bg-primary/90"
                >
                  {isEditableVenueApplicationStatus(venueApplication.status)
                    ? "Continue application"
                    : "View application"}
                </Link>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {!view.isPurePlayer ? (
        <section className="mt-10" aria-labelledby="personal-bookings-heading">
          <div className="rounded-[20px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:flex sm:items-center sm:justify-between sm:gap-6">
            <div>
              <h2
                id="personal-bookings-heading"
                className="text-xl text-primary"
              >
                Personal bookings
              </h2>
              <p className="mt-1 text-sm text-primary/60">
                Sessions you requested as a player.
              </p>
            </div>
            <Link
              href="/account/bookings"
              className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl border border-primary/15 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-surface sm:mt-0"
            >
              View my bookings
            </Link>
          </div>
        </section>
      ) : null}

      {view.showPartnerConversion ? (
        <section className="mt-10" aria-labelledby="partner-heading">
          <div className="rounded-[20px] border border-dashed border-primary/20 bg-surface/60 px-5 py-6 sm:px-6">
            <h2 id="partner-heading" className="text-lg text-primary">
              Are you a coach, academy or venue?
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-primary/65">
              Partner registration is separate from a player account.
            </p>
            <Link
              href="/join"
              className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl border border-primary/15 bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-white/80"
            >
              Become a Padel Pathways partner →
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
