import Link from "next/link";
import {
  APPLICATION_STATUS_LABELS,
  COACH_APPLICATION_STATUSES,
  type CoachApplicationStatus,
} from "@/lib/coachProfileApplication/constants";
import { listCoachApplications } from "@/lib/admin/applicationQueries";

type Props = {
  searchParams: Promise<{ status?: string | string[] }>;
};

const FILTER_STATUSES: readonly CoachApplicationStatus[] =
  COACH_APPLICATION_STATUSES.filter(
  (status) => status !== "draft"
);

function selectedStatuses(value: string | string[] | undefined): CoachApplicationStatus[] {
  const values = value ? (Array.isArray(value) ? value : [value]) : [];
  const valid = values.filter((item): item is CoachApplicationStatus =>
    FILTER_STATUSES.includes(item as CoachApplicationStatus)
  );
  return valid.length ? valid : ["submitted", "under_review"];
}

export default async function CoachApplicationQueuePage({ searchParams }: Props) {
  const params = await searchParams;
  const statuses = selectedStatuses(params.status);
  const applications = await listCoachApplications({ statuses });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
            Applications
          </p>
          <h1 className="mt-2">Coach queue</h1>
          <p className="mt-2 text-sm text-primary/60">
            {applications.length} application{applications.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/admin/applications/venues"
          className="text-sm font-semibold text-primary/60 hover:text-primary"
        >
          Venue queue →
        </Link>
      </div>

      <form className="mt-6 rounded-2xl border border-primary/10 bg-white p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          {FILTER_STATUSES.map((status) => (
            <label key={status} className="flex items-center gap-2 text-sm text-primary/70">
              <input
                type="checkbox"
                name="status"
                value={status}
                defaultChecked={statuses.includes(status)}
                className="h-4 w-4 rounded border-primary/20 accent-primary"
              />
              {APPLICATION_STATUS_LABELS[status]}
            </label>
          ))}
          <button
            type="submit"
            className="min-h-10 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent"
          >
            Apply filters
          </button>
        </div>
      </form>

      {applications.length === 0 ? (
        <div className="mt-6 rounded-[24px] border border-dashed border-primary/20 bg-white p-10 text-center text-sm text-primary/55">
          No coach applications match these filters.
        </div>
      ) : (
        <>
          <div className="mt-6 space-y-3 md:hidden">
            {applications.map((application) => (
              <Link
                key={application.id}
                href={`/admin/applications/coaches/${application.id}`}
                className="block rounded-2xl border border-primary/10 bg-white p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base">{application.full_name || "Unnamed applicant"}</h2>
                  <Status status={application.status} />
                </div>
                <p className="mt-2 text-sm text-primary/55">
                  {application.coaching_role?.replaceAll("_", " ") || "Role not supplied"}
                </p>
                <p className="mt-4 text-xs text-primary/45">
                  Updated {new Date(application.updated_at).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>

          <div className="mt-6 hidden overflow-hidden rounded-[24px] border border-primary/10 bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-primary/10 bg-surface/60 text-xs uppercase tracking-[0.1em] text-primary/45">
                <tr>
                  <th className="px-5 py-4 font-semibold">Applicant</th>
                  <th className="px-5 py-4 font-semibold">Role</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 font-semibold">Submitted</th>
                  <th className="px-5 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/10">
                {applications.map((application) => (
                  <tr key={application.id}>
                    <td className="px-5 py-4 font-semibold">
                      {application.full_name || "Unnamed applicant"}
                    </td>
                    <td className="px-5 py-4 capitalize text-primary/65">
                      {application.coaching_role?.replaceAll("_", " ") || "—"}
                    </td>
                    <td className="px-5 py-4"><Status status={application.status} /></td>
                    <td className="px-5 py-4 text-primary/55">
                      {application.submitted_at
                        ? new Date(application.submitted_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/admin/applications/coaches/${application.id}`}
                        className="font-semibold hover:underline"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Status({ status }: { status: CoachApplicationStatus }) {
  return (
    <span className="inline-flex rounded-full bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary/65">
      {APPLICATION_STATUS_LABELS[status]}
    </span>
  );
}
