import Link from "next/link";
import { notFound } from "next/navigation";
import CoachApplicationReviewPanel from "@/components/admin/CoachApplicationReviewPanel";
import {
  APPLICATION_STATUS_LABELS,
  AUDIENCES,
  COACHING_OUTCOMES,
  PLAYER_LEVELS,
  coachingRoleLabel,
  optionLabel,
} from "@/lib/coachProfileApplication/constants";
import { getCoachApplicationDetail } from "@/lib/admin/applicationQueries";

export default async function CoachApplicationDetailPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const detail = await getCoachApplicationDetail(applicationId);
  if (!detail) notFound();
  const { application, locations } = detail;

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
            Coach application
          </p>
          <h1 className="mt-2">{application.full_name || "Unnamed applicant"}</h1>
          <p className="mt-2 break-all text-xs text-primary/45">{application.id}</p>
        </div>
        <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-accent">
          {APPLICATION_STATUS_LABELS[application.status]}
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

          <Section title="Applicant">
            <dl className="grid gap-5 sm:grid-cols-2">
              <Detail label="Full name" value={application.full_name} />
              <Detail label="Phone" value={application.phone} />
              <Detail label="Role" value={coachingRoleLabel(application.coaching_role)} />
              <Detail label="Other role" value={application.coaching_role_other} />
              <Detail
                label="Experience"
                value={
                  application.experience_years === null
                    ? null
                    : `${application.experience_years} years`
                }
              />
              <Detail label="Applicant user ID" value={application.user_id} mono />
            </dl>
          </Section>

          <Section title="Locations">
            {locations.length ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {locations.map((location) => (
                  <li
                    key={location.id}
                    className="rounded-xl border border-primary/10 bg-surface/50 p-4 text-sm"
                  >
                    <span className="font-semibold">
                      {location.city}, {location.country}
                    </span>
                    {location.is_primary ? (
                      <span className="ml-2 text-xs text-primary/45">Primary</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-primary/55">No locations supplied.</p>
            )}
          </Section>

          <Section title="Coaching profile">
            <div className="space-y-5">
              <Detail
                label="Player levels"
                value={application.player_levels
                  .map((value) => optionLabel(PLAYER_LEVELS, value))
                  .join(", ")}
              />
              <Detail
                label="Audiences"
                value={application.audiences
                  .map((value) => optionLabel(AUDIENCES, value))
                  .join(", ")}
              />
              <Detail
                label="Outcomes"
                value={application.outcomes
                  .map((value) => optionLabel(COACHING_OUTCOMES, value))
                  .join(", ")}
              />
              <Detail label="Description" value={application.description} multiline />
            </div>
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
        </div>

        <CoachApplicationReviewPanel application={application} />
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
