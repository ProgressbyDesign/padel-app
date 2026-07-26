import Link from "next/link";
import AccountHeader from "@/components/account/AccountHeader";
import EmptyAccountState from "@/components/account/EmptyAccountState";
import ManagedListingCard from "@/components/account/ManagedListingCard";
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
  const hasMemberships = data.coaches.length > 0 || data.venues.length > 0;
  const coachApplication = data.coachApplication;
  const venueApplication = data.venueApplication;
  const hasPlayerBookingAttention =
    data.bookingAttention.playerAwaiting > 0 ||
    data.bookingAttention.playerAcceptedUpcoming > 0;

  return (
    <div className="mx-auto w-full max-w-[1680px] px-4 py-10 sm:px-6 sm:py-14 lg:px-[120px]">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
          Personal workspace
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-primary sm:text-4xl">
          Welcome{data.account.fullName ? `, ${data.account.fullName}` : ""}
        </h1>
        <p className="mt-3 text-base leading-6 text-primary/65">
          Your sessions, applications, and managed profiles in one place.
        </p>
      </div>

      <div className="mt-8">
        <AccountHeader email={data.account.email} />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/account/bookings"
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-primary/15 bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-surface"
        >
          My bookings
        </Link>
        <Link
          href="/join"
          className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:bg-primary/90"
        >
          Add or claim a profile
        </Link>
      </div>

      {hasPlayerBookingAttention ? (
        <section className="mt-10" aria-labelledby="bookings-attention-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                id="bookings-attention-heading"
                className="text-2xl font-bold text-primary"
              >
                Bookings needing attention
              </h2>
              <p className="mt-1 text-sm text-primary/60">
                Session requests that need attention.
              </p>
            </div>
            <Link
              href="/account/bookings"
              className="text-sm font-semibold text-primary/70 transition hover:text-primary"
            >
              View my bookings
            </Link>
          </div>
          <ul className="mt-5 space-y-3">
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
          </ul>
        </section>
      ) : null}

      <section className="mt-10" aria-labelledby="applications-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="applications-heading" className="text-2xl font-bold text-primary">
              Applications
            </h2>
            <p className="mt-1 text-sm text-primary/60">
              Active partner applications. Approved profiles appear under managed
              listings below.
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
          <div className="rounded-[20px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)]">
            {!coachApplication ? (
              <div>
                <h3 className="text-lg font-bold text-primary">Coach application</h3>
                <p className="mt-2 text-sm text-primary/65">
                  Create a new coach profile or claim an existing listing.
                </p>
                <Link
                  href="/join"
                  className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:bg-primary/90"
                >
                  Add or claim a profile
                </Link>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-bold text-primary">
                  {isEditableApplicationStatus(coachApplication.status)
                    ? "Continue coach application"
                    : coachApplication.status === "submitted" ||
                        coachApplication.status === "under_review"
                      ? "Coach application submitted"
                      : "Coach application"}
                </h3>
                <p className="mt-2 text-sm text-primary/65">
                  Status: {APPLICATION_STATUS_LABELS[coachApplication.status]} · Step{" "}
                  {coachApplication.currentStep} of 4
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
            )}
          </div>

          <div className="rounded-[20px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)]">
            {!venueApplication ? (
              <div>
                <h3 className="text-lg font-bold text-primary">Venue application</h3>
                <p className="mt-2 text-sm text-primary/65">
                  Claim an existing venue or propose a new listing.
                </p>
                <Link
                  href="/join"
                  className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:bg-primary/90"
                >
                  Add or claim a profile
                </Link>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-bold text-primary">
                  {isEditableVenueApplicationStatus(venueApplication.status)
                    ? "Continue venue application"
                    : venueApplication.status === "submitted" ||
                        venueApplication.status === "under_review"
                      ? "Venue application submitted"
                      : "Venue application"}
                </h3>
                <p className="mt-2 text-sm text-primary/65">
                  Status: {VENUE_APPLICATION_STATUS_LABELS[venueApplication.status]} · Step{" "}
                  {venueApplication.currentStep} of 4
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
            )}
          </div>
        </div>
      </section>

      {data.relationshipAttention.items.length > 0 ? (
        <section className="mt-10" aria-labelledby="relationships-attention-heading">
          <div>
            <h2
              id="relationships-attention-heading"
              className="text-2xl font-bold text-primary"
            >
              Relationship updates
            </h2>
            <p className="mt-1 text-sm text-primary/60">
              Coach and venue relationship actions that need your attention.
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
          </ul>
        </section>
      ) : null}

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
