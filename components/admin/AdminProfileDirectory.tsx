import Link from "next/link";
import { AdminBadge } from "@/components/admin/ui";
import {
  PROFILE_DIRECTORY_FILTERS,
  PROFILE_DIRECTORY_FILTER_LABELS,
  buildProfileDirectoryQueryString,
  directoryAccountLabel,
  directoryLaunchLabel,
  directoryVerificationLabel,
  directoryVisibilityLabel,
  type ParsedProfileDirectoryParams,
  type ProfileDirectoryRow,
} from "@/lib/admin/profileDirectory";
import type { LifecycleBadgeTone } from "@/lib/lifecycle/adminStatus";

export function AdminProfileDirectory({
  title,
  eyebrow,
  nameColumn,
  countNoun,
  allCount,
  rows,
  pageRows,
  page,
  pageCount,
  params,
  basePath,
}: {
  title: string;
  eyebrow: string;
  nameColumn: string;
  countNoun: string;
  allCount: number;
  rows: ProfileDirectoryRow[];
  pageRows: ProfileDirectoryRow[];
  page: number;
  pageCount: number;
  params: ParsedProfileDirectoryParams;
  basePath: string;
}) {
  const matching = rows.length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
          {eyebrow}
        </p>
        <h1 className="mt-2">{title}</h1>
        <p className="mt-2 text-sm text-primary/60">
          {allCount} {countNoun}
          {params.filter !== "all" || params.q
            ? ` · ${matching} matching`
            : ""}
        </p>
      </div>

      <form
        className="rounded-2xl border border-primary/10 bg-white p-4"
        action={basePath}
        method="get"
      >
        {params.filter !== "all" ? (
          <input type="hidden" name="filter" value={params.filter} />
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <label className="min-w-[12rem] flex-1 text-sm font-medium text-primary">
            Search by name
            <input
              type="search"
              name="q"
              defaultValue={params.q}
              placeholder={`${title} name`}
              className="mt-1.5 w-full rounded-xl border border-primary/15 px-3 py-2 text-sm outline-none focus:border-primary/35"
            />
          </label>
          <button
            type="submit"
            className="mt-6 min-h-10 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent"
          >
            Search
          </button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        {PROFILE_DIRECTORY_FILTERS.map((filter) => {
          const href = `${basePath}${buildProfileDirectoryQueryString({
            q: params.q,
            filter,
            page: 1,
          })}`;
          const active = params.filter === filter;
          return (
            <Link
              key={filter}
              href={href}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "bg-primary text-accent"
                  : "border border-primary/15 bg-white text-primary/70 hover:bg-surface"
              }`}
            >
              {PROFILE_DIRECTORY_FILTER_LABELS[filter]}
            </Link>
          );
        })}
      </div>

      {pageRows.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-primary/20 bg-white p-10 text-center text-sm text-primary/55">
          No {countNoun} match these filters.
        </div>
      ) : (
        <>
          <div className="space-y-3 lg:hidden">
            {pageRows.map((row) => (
              <DirectoryCard key={row.id} row={row} />
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-[24px] border border-primary/10 bg-white lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-primary/10 bg-surface/60 text-xs uppercase tracking-[0.1em] text-primary/45">
                <tr>
                  <th className="px-5 py-4 font-semibold">{nameColumn}</th>
                  <th className="px-5 py-4 font-semibold">Location</th>
                  <th className="px-5 py-4 font-semibold">Source</th>
                  <th className="px-5 py-4 font-semibold">Verification</th>
                  <th className="px-5 py-4 font-semibold">Account</th>
                  <th className="px-5 py-4 font-semibold">Launch</th>
                  <th className="px-5 py-4 font-semibold">Visibility</th>
                  <th className="px-5 py-4 font-semibold">Completion</th>
                  <th className="px-5 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/10">
                {pageRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-5 py-4 font-semibold">{row.name}</td>
                    <td className="px-5 py-4 text-primary/65">
                      {row.location || "—"}
                    </td>
                    <td className="px-5 py-4 text-primary/65">{row.sourceLabel}</td>
                    <td className="px-5 py-4">
                      <AdminBadge tone={row.isApproved ? "ok" : "warn"}>
                        {directoryVerificationLabel(row.isApproved)}
                      </AdminBadge>
                    </td>
                    <td className="px-5 py-4">
                      <AdminBadge tone={row.hasAccount ? "ok" : "neutral"}>
                        {directoryAccountLabel(row.hasAccount)}
                      </AdminBadge>
                    </td>
                    <td className="px-5 py-4">
                      <AdminBadge tone={launchTone(row.launchSelectionStatus)}>
                        {directoryLaunchLabel(row.launchSelectionStatus)}
                      </AdminBadge>
                    </td>
                    <td className="px-5 py-4">
                      <AdminBadge tone={visibilityTone(row.publicationStatus)}>
                        {directoryVisibilityLabel(row.publicationStatus)}
                      </AdminBadge>
                    </td>
                    <td className="px-5 py-4 text-primary/65">
                      {row.completionPercent == null
                        ? "—"
                        : `${row.completionPercent}%`}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={row.href}
                        className="font-semibold hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 ? (
            <div className="flex items-center justify-between text-sm text-primary/70">
              <span>
                Page {page} of {pageCount}
              </span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link
                    href={`${basePath}${buildProfileDirectoryQueryString({
                      ...params,
                      page: page - 1,
                    })}`}
                    className="rounded-xl border border-primary/15 px-3 py-1.5 hover:bg-white"
                  >
                    Previous
                  </Link>
                ) : null}
                {page < pageCount ? (
                  <Link
                    href={`${basePath}${buildProfileDirectoryQueryString({
                      ...params,
                      page: page + 1,
                    })}`}
                    className="rounded-xl border border-primary/15 px-3 py-1.5 hover:bg-white"
                  >
                    Next
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function DirectoryCard({ row }: { row: ProfileDirectoryRow }) {
  return (
    <Link
      href={row.href}
      className="block rounded-2xl border border-primary/10 bg-white p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold">{row.name}</h2>
        <AdminBadge tone={visibilityTone(row.publicationStatus)}>
          {directoryVisibilityLabel(row.publicationStatus)}
        </AdminBadge>
      </div>
      <p className="mt-2 text-sm text-primary/55">{row.location || "No location"}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <AdminBadge tone="neutral">{row.sourceLabel}</AdminBadge>
        <AdminBadge tone={row.isApproved ? "ok" : "warn"}>
          {directoryVerificationLabel(row.isApproved)}
        </AdminBadge>
        <AdminBadge tone={row.hasAccount ? "ok" : "neutral"}>
          {directoryAccountLabel(row.hasAccount)}
        </AdminBadge>
        <AdminBadge tone={launchTone(row.launchSelectionStatus)}>
          {directoryLaunchLabel(row.launchSelectionStatus)}
        </AdminBadge>
      </div>
    </Link>
  );
}

function launchTone(
  status: ProfileDirectoryRow["launchSelectionStatus"]
): LifecycleBadgeTone {
  if (status === "selected") return "ok";
  if (status === "excluded") return "bad";
  return "neutral";
}

function visibilityTone(
  status: ProfileDirectoryRow["publicationStatus"]
): LifecycleBadgeTone {
  if (status === "published") return "ok";
  if (status === "suspended") return "bad";
  return "neutral";
}
