"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  bulkPublishProfiles,
  bulkUnpublishProfiles,
} from "@/app/admin/(ops)/publicationActions";
import { AdminBadge } from "@/components/admin/ui";
import {
  PROFILE_DIRECTORY_FILTERS,
  PROFILE_DIRECTORY_FILTER_LABELS,
  buildProfileDirectoryQueryString,
  directoryAccountLabel,
  directoryStatusLabel,
  directoryVerificationLabel,
  type ParsedProfileDirectoryParams,
  type ProfileDirectoryRow,
} from "@/lib/admin/profileDirectory";
import {
  applySelectAllPage,
  currentPageSelectionState,
  publicationKindNoun,
  type ProfilePublicationKind,
} from "@/lib/admin/publication";
import type { LifecycleBadgeTone } from "@/lib/lifecycle/adminStatus";

export function AdminProfileDirectory(props: {
  title: string;
  eyebrow: string;
  nameColumn: string;
  countNoun: string;
  kind: ProfilePublicationKind;
  canManage: boolean;
  allCount: number;
  rows: ProfileDirectoryRow[];
  pageRows: ProfileDirectoryRow[];
  page: number;
  pageCount: number;
  params: ParsedProfileDirectoryParams;
  basePath: string;
}) {
  const selectionKey = `${props.basePath}|${props.params.q}|${props.params.filter}|${props.page}`;
  return <DirectoryBody key={selectionKey} {...props} />;
}

function DirectoryBody({
  title,
  eyebrow,
  nameColumn,
  countNoun,
  kind,
  canManage,
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
  kind: ProfilePublicationKind;
  canManage: boolean;
  allCount: number;
  rows: ProfileDirectoryRow[];
  pageRows: ProfileDirectoryRow[];
  page: number;
  pageCount: number;
  params: ParsedProfileDirectoryParams;
  basePath: string;
}) {
  const matching = rows.length;
  const pageIds = useMemo(() => pageRows.map((row) => row.id), [pageRows]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [resultOk, setResultOk] = useState(true);

  const { allSelected, someSelected } = currentPageSelectionState(
    pageIds,
    selectedIds
  );

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

      {canManage && selectedIds.length > 0 ? (
        <BulkActionBar
          kind={kind}
          selectedIds={selectedIds}
          onResult={(ok, message) => {
            setResultOk(ok);
            setResult(message);
            if (ok) setSelectedIds([]);
          }}
        />
      ) : null}

      {result ? (
        <p
          role="status"
          className={`text-sm ${resultOk ? "text-emerald-700" : "text-red-700"}`}
        >
          {result}
        </p>
      ) : null}

      {pageRows.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-primary/20 bg-white p-10 text-center text-sm text-primary/55">
          No {countNoun} match these filters.
        </div>
      ) : (
        <>
          <div className="space-y-3 lg:hidden">
            {pageRows.map((row) => (
              <DirectoryCard
                key={row.id}
                row={row}
                selectable={canManage}
                checked={selectedIds.includes(row.id)}
                onToggle={(checked) =>
                  setSelectedIds((current) =>
                    checked
                      ? current.includes(row.id)
                        ? current
                        : [...current, row.id]
                      : current.filter((id) => id !== row.id)
                  )
                }
              />
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-[24px] border border-primary/10 bg-white lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-primary/10 bg-surface/60 text-xs uppercase tracking-[0.1em] text-primary/45">
                <tr>
                  {canManage ? (
                    <th className="w-12 px-5 py-4">
                      <SelectAllCheckbox
                        allSelected={allSelected}
                        someSelected={someSelected}
                        onChange={(checked) =>
                          setSelectedIds(
                            applySelectAllPage(pageIds, selectedIds, checked)
                          )
                        }
                      />
                    </th>
                  ) : null}
                  <th className="px-5 py-4 font-semibold">{nameColumn}</th>
                  <th className="px-5 py-4 font-semibold">Location</th>
                  <th className="px-5 py-4 font-semibold">Source</th>
                  <th className="px-5 py-4 font-semibold">Verification</th>
                  <th className="px-5 py-4 font-semibold">Account</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 font-semibold">Completion</th>
                  <th className="px-5 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/10">
                {pageRows.map((row) => (
                  <tr key={row.id}>
                    {canManage ? (
                      <td className="px-5 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(row.id)}
                          onChange={(event) =>
                            setSelectedIds((current) =>
                              event.target.checked
                                ? current.includes(row.id)
                                  ? current
                                  : [...current, row.id]
                                : current.filter((id) => id !== row.id)
                            )
                          }
                          aria-label={`Select ${row.name}`}
                          className="h-4 w-4 accent-primary"
                        />
                      </td>
                    ) : null}
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
                      <AdminBadge tone={statusTone(row.publicationStatus)}>
                        {directoryStatusLabel(row.publicationStatus)}
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

function SelectAllCheckbox({
  allSelected,
  someSelected,
  onChange,
}: {
  allSelected: boolean;
  someSelected: boolean;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = someSelected;
  }, [someSelected]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={allSelected}
      onChange={(event) => onChange(event.target.checked)}
      aria-label="Select all profiles on this page"
      className="h-4 w-4 accent-primary"
    />
  );
}

function BulkActionBar({
  kind,
  selectedIds,
  onResult,
}: {
  kind: ProfilePublicationKind;
  selectedIds: string[];
  onResult: (ok: boolean, message: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const noun = publicationKindNoun(kind, selectedIds.length);

  function run(action: "publish" | "unpublish") {
    const count = selectedIds.length;
    const confirmMessage =
      action === "publish"
        ? `Publish ${count} selected ${noun}?`
        : `Unpublish ${count} selected ${noun}?`;
    if (!window.confirm(confirmMessage)) return;

    startTransition(async () => {
      const result =
        action === "publish"
          ? await bulkPublishProfiles(kind, selectedIds)
          : await bulkUnpublishProfiles(kind, selectedIds);
      onResult(result.ok, result.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/15 bg-white px-4 py-3">
      <p className="text-sm font-semibold text-primary">
        {selectedIds.length} selected
      </p>
      <label className="flex items-center gap-2 text-sm">
        <span className="sr-only">Bulk actions</span>
        <select
          disabled={pending}
          defaultValue=""
          onChange={(event) => {
            const value = event.target.value;
            event.target.value = "";
            if (value === "publish" || value === "unpublish") run(value);
          }}
          className="min-h-10 rounded-xl border border-primary/15 bg-white px-3 py-2 font-semibold text-primary disabled:opacity-50"
        >
          <option value="" disabled>
            {pending ? "Updating…" : "Actions"}
          </option>
          <option value="publish">Publish</option>
          <option value="unpublish">Unpublish</option>
        </select>
      </label>
    </div>
  );
}

function DirectoryCard({
  row,
  selectable,
  checked,
  onToggle,
}: {
  row: ProfileDirectoryRow;
  selectable: boolean;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-5">
      <div className="flex items-start gap-3">
        {selectable ? (
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onToggle(event.target.checked)}
            aria-label={`Select ${row.name}`}
            className="mt-1 h-4 w-4 shrink-0 accent-primary"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <Link href={row.href} className="text-base font-semibold hover:underline">
              {row.name}
            </Link>
            <AdminBadge tone={statusTone(row.publicationStatus)}>
              {directoryStatusLabel(row.publicationStatus)}
            </AdminBadge>
          </div>
          <p className="mt-2 text-sm text-primary/55">
            {row.location || "No location"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <AdminBadge tone="neutral">{row.sourceLabel}</AdminBadge>
            <AdminBadge tone={row.isApproved ? "ok" : "warn"}>
              {directoryVerificationLabel(row.isApproved)}
            </AdminBadge>
            <AdminBadge tone={row.hasAccount ? "ok" : "neutral"}>
              {directoryAccountLabel(row.hasAccount)}
            </AdminBadge>
          </div>
        </div>
      </div>
    </div>
  );
}

function statusTone(
  status: ProfileDirectoryRow["publicationStatus"]
): LifecycleBadgeTone {
  if (status === "published") return "ok";
  if (status === "suspended") return "bad";
  return "neutral";
}
