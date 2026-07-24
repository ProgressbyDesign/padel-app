import Link from "next/link";
import { notFound } from "next/navigation";
import VenueApplicationReviewPanel from "@/components/admin/VenueApplicationReviewPanel";
import { getVenueApplicationDetail } from "@/lib/admin/applicationQueries";
import {
  VENUE_APPLICATION_STATUS_LABELS,
  venueApplicationModeLabel,
  venueRelationshipLabel,
} from "@/lib/venueProfileApplication/constants";

export default async function VenueApplicationDetailPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const detail = await getVenueApplicationDetail(applicationId);
  if (!detail) notFound();
  const { application, targetVenue, approvedVenue, memberships } = detail;
  const hasOwner = memberships.some(
    (membership) => membership.membership_role === "owner"
  );

  return (
    <div>
      <Link
        href="/admin/applications/venues"
        className="text-sm font-semibold text-primary/55 hover:text-primary"
      >
        ← Venue queue
      </Link>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
            Venue application
          </p>
          <h1 className="mt-2">
            {application.proposed_venue_name || targetVenue?.name || "Venue claim"}
          </h1>
          <p className="mt-2 break-all text-xs text-primary/45">{application.id}</p>
        </div>
        <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-accent">
          {VENUE_APPLICATION_STATUS_LABELS[application.status]}
        </span>
      </div>

      <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
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
                value={venueApplicationModeLabel(application.application_mode)}
              />
              <Detail
                label="Applicant relationship"
                value={venueRelationshipLabel(application.relationship_to_venue)}
              />
              <Detail label="Phone" value={application.phone} />
              <Detail label="Applicant user ID" value={application.user_id} mono />
            </dl>
            <div className="mt-5">
              <Detail
                label="Supporting note"
                value={application.supporting_note}
                multiline
              />
            </div>
          </Section>

          <Section
            title={
              application.application_mode === "claim_existing"
                ? "Claimed venue"
                : "Proposed venue"
            }
          >
            {application.application_mode === "claim_existing" ? (
              <dl className="grid gap-5 sm:grid-cols-2">
                <Detail label="Venue name" value={targetVenue?.name} />
                <Detail
                  label="Location"
                  value={[targetVenue?.city, targetVenue?.country]
                    .filter(Boolean)
                    .join(", ")}
                />
                <Detail label="Website" value={targetVenue?.website} />
                <Detail label="Target venue ID" value={application.target_venue_id} mono />
              </dl>
            ) : (
              <dl className="grid gap-5 sm:grid-cols-2">
                <Detail label="Name" value={application.proposed_venue_name} />
                <Detail label="Country" value={application.proposed_country} />
                <Detail label="City" value={application.proposed_city} />
                <Detail label="Address" value={application.proposed_address} />
                <Detail label="Website" value={application.proposed_website} />
              </dl>
            )}
          </Section>

          <Section title="Existing venue memberships">
            {hasOwner ? (
              <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                Warning: this venue already has an owner membership.
              </p>
            ) : null}
            {memberships.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.1em] text-primary/40">
                    <tr>
                      <th className="pb-3 pr-4 font-semibold">User ID</th>
                      <th className="pb-3 pr-4 font-semibold">Role</th>
                      <th className="pb-3 font-semibold">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/10">
                    {memberships.map((membership) => (
                      <tr key={`${membership.venue_id}-${membership.user_id}`}>
                        <td className="break-all py-3 pr-4 font-mono text-xs">
                          {membership.user_id}
                        </td>
                        <td className="py-3 pr-4 capitalize">{membership.membership_role}</td>
                        <td className="py-3 text-primary/55">
                          {new Date(membership.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-primary/55">No memberships on this venue.</p>
            )}
          </Section>

          <Section title="Application record">
            <dl className="grid gap-5 sm:grid-cols-2">
              <Detail label="Current step" value={`${application.current_step} of 4`} />
              <Detail label="Created" value={formatDate(application.created_at)} />
              <Detail label="Updated" value={formatDate(application.updated_at)} />
              <Detail label="Submitted" value={formatDate(application.submitted_at)} />
              <Detail label="Terms accepted" value={formatDate(application.terms_accepted_at)} />
              <Detail label="Privacy accepted" value={formatDate(application.privacy_accepted_at)} />
              <Detail label="Reviewed" value={formatDate(application.reviewed_at)} />
              <Detail label="Reviewer user ID" value={application.reviewed_by_user_id} mono />
              <Detail label="Approved role" value={application.approved_membership_role} />
              <Detail label="Approved venue ID" value={application.approved_venue_id} mono />
            </dl>
            {approvedVenue && application.approved_venue_id ? (
              <Link
                href={`/account/venues/${application.approved_venue_id}`}
                className="mt-5 inline-flex min-h-10 items-center rounded-xl border border-primary/15 px-4 text-sm font-semibold"
              >
                Open {approvedVenue.name || "approved venue"}
              </Link>
            ) : null}
          </Section>
        </div>

        <VenueApplicationReviewPanel application={application} hasOwner={hasOwner} />
      </div>
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
