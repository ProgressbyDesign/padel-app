import Link from "next/link";
import WithdrawVenueApplicationButton from "@/components/account/applications/WithdrawVenueApplicationButton";
import {
  VENUE_APPLICATION_STATUS_LABELS,
  isWithdrawableVenueApplicationStatus,
  venueApplicationModeLabel,
  venueRelationshipLabel,
} from "@/lib/venueProfileApplication/constants";
import type { VenueApplicationWithVenue } from "@/lib/venueProfileApplication/types";

/**
 * Read-only surface for historical `claim_existing` venue applications.
 * Never renders the editable wizard and never converts to create_new.
 */
export default function VenueLegacyClaimApplication({
  data,
}: {
  data: VenueApplicationWithVenue;
}) {
  const { application, targetVenue } = data;
  const canWithdraw = isWithdrawableVenueApplicationStatus(application.status);

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-6 text-amber-950">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-amber-900/70">
          Legacy venue claim
        </p>
        <h2 className="mt-2 text-2xl">
          This claim is read-only
        </h2>
        <p className="mt-3 text-sm leading-6 text-amber-950/80">
          Public claiming of existing venue listings is closed. Your historical
          claim stays visible so you can track its status
          {canWithdraw ? " or withdraw it" : ""}, but you cannot edit fields,
          change steps, submit it, or convert it to a new venue application.
        </p>
        <p className="mt-2 text-sm font-semibold text-amber-950/90">
          Mode and target venue are locked as{" "}
          {venueApplicationModeLabel("claim_existing")}.
        </p>
      </section>

      <section className="rounded-[24px] border border-primary/10 bg-white p-6 shadow-[0_8px_28px_rgba(3,19,34,0.04)]">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
          Application status
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h3 className="text-2xl text-primary">
            {VENUE_APPLICATION_STATUS_LABELS[application.status]}
          </h3>
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
        {application.status === "approved" && application.approved_venue_id ? (
          <Link
            href={`/account/venues/${application.approved_venue_id}`}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90"
          >
            Open venue dashboard
          </Link>
        ) : null}
      </section>

      <section className="rounded-[24px] border border-primary/10 bg-white p-6">
        <h3 className="text-lg text-primary">Claim details</h3>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Detail
            label="Relationship"
            value={venueRelationshipLabel(application.relationship_to_venue)}
          />
          <Detail label="Phone" value={application.phone || "—"} />
          <Detail
            label="Venue"
            value={targetVenue?.name || "Venue unavailable"}
          />
          <Detail
            label="Location"
            value={
              [targetVenue?.city, targetVenue?.country]
                .filter(Boolean)
                .join(", ") || "—"
            }
          />
        </dl>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-primary/75">
          {application.supporting_note || "No supporting note was provided."}
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/account/applications"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/15 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-surface"
        >
          Back to applications
        </Link>
        {canWithdraw ? (
          <WithdrawVenueApplicationButton applicationId={application.id} />
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
