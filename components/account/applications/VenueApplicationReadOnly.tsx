import Link from "next/link";
import {
  VENUE_APPLICATION_STATUS_LABELS,
  venueApplicationModeLabel,
  venueRelationshipLabel,
} from "@/lib/venueProfileApplication/constants";
import type { VenueApplicationWithVenue } from "@/lib/venueProfileApplication/types";

export default function VenueApplicationReadOnly({
  data,
}: {
  data: VenueApplicationWithVenue;
}) {
  const { application, targetVenue } = data;

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-primary/10 bg-white p-6 shadow-[0_8px_28px_rgba(3,19,34,0.04)]">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
          Application status
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold text-primary">
            {VENUE_APPLICATION_STATUS_LABELS[application.status]}
          </h2>
          <span className="rounded-full border border-primary/10 bg-surface px-3 py-1 text-xs font-semibold text-primary/70">
            Step {application.current_step} of 4
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-primary/65">
          {application.status === "submitted" ||
          application.status === "under_review"
            ? "Your venue application is with our team. Editing is locked until review finishes."
            : application.status === "approved"
              ? "Approved. Membership was created from this application — open your venue dashboard to finish the listing."
              : application.status === "declined"
                ? "This application was declined. Review the note below or contact Padel Pathways for guidance."
                : application.status === "withdrawn"
                  ? "This application was withdrawn."
                  : "This application is currently read-only."}
        </p>
        {application.submitted_at ? (
          <p className="mt-2 text-sm text-primary/55">
            Submitted{" "}
            {new Date(application.submitted_at).toLocaleString(undefined, {
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
        {application.status === "approved" &&
        application.approved_venue_id ? (
          <Link
            href={`/account/venues/${application.approved_venue_id}`}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90"
          >
            Open venue dashboard
          </Link>
        ) : null}
      </section>

      <section className="rounded-[24px] border border-primary/10 bg-white p-6">
        <h3 className="text-lg font-bold text-primary">Your role</h3>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Detail
            label="Relationship"
            value={venueRelationshipLabel(application.relationship_to_venue)}
          />
          <Detail label="Phone" value={application.phone || "—"} />
        </dl>
      </section>

      <section className="rounded-[24px] border border-primary/10 bg-white p-6">
        <h3 className="text-lg font-bold text-primary">Venue</h3>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Detail
            label="Application type"
            value={venueApplicationModeLabel(application.application_mode)}
          />
          {application.application_mode === "claim_existing" ? (
            <>
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
            </>
          ) : (
            <>
              <Detail
                label="Proposed venue name"
                value={application.proposed_venue_name || "—"}
              />
              <Detail
                label="Country"
                value={application.proposed_country || "—"}
              />
              <Detail
                label="City"
                value={application.proposed_city || "—"}
              />
              <Detail
                label="Address"
                value={application.proposed_address || "—"}
              />
              <Detail
                label="Website"
                value={application.proposed_website || "—"}
              />
            </>
          )}
        </dl>
      </section>

      <section className="rounded-[24px] border border-primary/10 bg-white p-6">
        <h3 className="text-lg font-bold text-primary">Supporting note</h3>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-primary/75">
          {application.supporting_note || "No supporting note was provided."}
        </p>
      </section>

      <Link
        href="/account/applications"
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/15 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-surface"
      >
        Back to applications
      </Link>
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
