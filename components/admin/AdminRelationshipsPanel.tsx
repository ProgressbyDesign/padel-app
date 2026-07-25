"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  adminApproveCoachVenueRelationship,
  adminCancelCoachVenueRelationship,
  adminCreateCoachVenueRelationship,
  adminDeclineCoachVenueRelationship,
  adminEndCoachVenueRelationship,
  adminRemoveImportedCoachVenueRelationship,
  adminSetPrimaryCoachVenue,
  adminVerifyImportedCoachVenueRelationship,
  searchAdminCoachesForRelationshipAction,
  searchAdminVenuesForRelationshipAction,
} from "@/app/admin/(ops)/relationships/actions";
import {
  ActionButton,
  ConfirmActionButton,
  StatusBadge,
} from "@/components/account/RelationshipActionControls";
import {
  COACH_VENUE_INITIATOR_LABELS,
  COACH_VENUE_STATUS_LABELS,
  type CoachVenueStatus,
} from "@/lib/coachVenues/constants";
import type { AdminRelationshipListItem } from "@/lib/admin/relationshipQueries";
import type { AdminEntitySearchResult } from "@/lib/admin/relationshipQueries";

function formatDate(value: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function statusTone(status: string) {
  if (status === "active") return "green" as const;
  if (status === "unverified" || status === "pending") return "amber" as const;
  if (status === "declined") return "red" as const;
  return "neutral" as const;
}

export default function AdminRelationshipsPanel({
  rows,
  buckets,
  initialStatus,
  availability = {},
}: {
  rows: AdminRelationshipListItem[];
  buckets: Record<"pending" | "unverified" | "active" | "past", number>;
  initialStatus: string | null;
  availability?: Record<
    string,
    {
      configured: boolean;
      isPublic: boolean;
      timezone: string | null;
      ruleCount: number;
      upcomingExceptionCount: number;
    }
  >;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId]
  );

  function applyResult(result: { ok: boolean; message: string }) {
    if (result.ok) {
      setFeedback(result.message);
      setError(null);
      router.refresh();
    } else {
      setError(result.message);
    }
  }

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    setFeedback(null);
    setError(null);
    startTransition(async () => {
      applyResult(await action());
    });
  }

  return (
    <div className="space-y-8">
      {(feedback || error) && (
        <div
          role="status"
          className={`rounded-xl px-4 py-3 text-sm ${
            error ? "bg-red-50 text-red-900" : "bg-emerald-50 text-emerald-900"
          }`}
        >
          {error ?? feedback}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            ["pending", "Pending"],
            ["unverified", "Imported / unverified"],
            ["active", "Active"],
            ["past", "Past"],
          ] as const
        ).map(([key, label]) => (
          <Link
            key={key}
            href={
              key === "past"
                ? "/admin/relationships?status=past"
                : `/admin/relationships?status=${key === "unverified" ? "unverified" : key}`
            }
            className={`rounded-2xl border p-4 transition ${
              initialStatus === key ||
              (key === "past" && initialStatus === "past")
                ? "border-primary bg-primary text-accent"
                : "border-primary/10 bg-white hover:border-primary/25"
            }`}
          >
            <span className="block text-2xl font-bold">{buckets[key]}</span>
            <span className="mt-1 block text-xs opacity-80">{label}</span>
          </Link>
        ))}
      </div>

      <AdminCreateRelationshipForm
        pending={pending}
        onCreated={applyResult}
        startTransition={startTransition}
      />

      <form
        method="get"
        action="/admin/relationships"
        className="grid gap-3 rounded-[24px] border border-primary/10 bg-white p-4 sm:grid-cols-4 sm:p-5"
      >
        <label className="text-xs font-semibold text-primary/70">
          Status
          <select
            name="status"
            defaultValue={initialStatus ?? ""}
            className="mt-1 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2 text-sm font-normal text-primary"
          >
            <option value="">All</option>
            <option value="past">Past (declined / cancelled / ended)</option>
            {Object.entries(COACH_VENUE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-primary/70">
          Initiated by
          <select
            name="initiated_by"
            className="mt-1 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2 text-sm font-normal text-primary"
          >
            <option value="">All</option>
            {Object.entries(COACH_VENUE_INITIATOR_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-primary/70">
          Coach name
          <input
            name="coach"
            placeholder="Filter coach"
            className="mt-1 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2 text-sm font-normal text-primary"
          />
        </label>
        <label className="text-xs font-semibold text-primary/70">
          Venue name
          <input
            name="venue"
            placeholder="Filter venue"
            className="mt-1 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2 text-sm font-normal text-primary"
          />
        </label>
        <div className="sm:col-span-4">
          <button
            type="submit"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent"
          >
            Apply filters
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-[24px] border border-primary/10 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-primary/10 bg-surface/70 text-xs uppercase tracking-wide text-primary/50">
            <tr>
              <th className="px-4 py-3 font-semibold">Coach</th>
              <th className="px-4 py-3 font-semibold">Venue</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Initiator</th>
              <th className="px-4 py-3 font-semibold">Requested</th>
              <th className="px-4 py-3 font-semibold">Primary</th>
              <th className="px-4 py-3 font-semibold">Availability</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-primary/50">
                  No relationships match these filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const hint = availability[row.id];
                return (
                <tr key={row.id} className="border-b border-primary/5 align-top">
                  <td className="px-4 py-3">
                    <Link
                      href={`/coach/${row.coach_id}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {row.coach?.name ?? "Coach"}
                    </Link>
                    <p className="text-xs text-primary/45">{row.coach?.role}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/venue/${row.venue_id}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {row.venue?.name ?? "Venue"}
                    </Link>
                    <p className="text-xs text-primary/45">
                      {[row.venue?.city, row.venue?.country]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={statusTone(row.status)}>
                      {COACH_VENUE_STATUS_LABELS[row.status as CoachVenueStatus]}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-primary/70">
                    {COACH_VENUE_INITIATOR_LABELS[row.initiated_by]}
                    {row.requesterLabel ? (
                      <p className="text-xs text-primary/45">{row.requesterLabel}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-primary/60">
                    {formatDate(row.requested_at)}
                  </td>
                  <td className="px-4 py-3">{row.is_primary ? "Yes" : "—"}</td>
                  <td className="px-4 py-3 text-xs text-primary/70">
                    {row.status !== "active" ? (
                      "—"
                    ) : hint?.configured ? (
                      <>
                        <p>
                          {hint.isPublic ? "Public" : "Private"}
                          {hint.timezone ? ` · ${hint.timezone}` : ""}
                        </p>
                        <p className="mt-1 text-primary/45">
                          {hint.ruleCount} rules · {hint.upcomingExceptionCount} exceptions
                        </p>
                      </>
                    ) : (
                      "Not configured"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <ActionButton
                        tone="secondary"
                        pending={pending}
                        onClick={() =>
                          setSelectedId((current) =>
                            current === row.id ? null : row.id
                          )
                        }
                      >
                        {selectedId === row.id ? "Hide" : "Details"}
                      </ActionButton>
                      {row.status === "active" ? (
                        <Link
                          href={`/account/coaches/${row.coach_id}/availability/${row.id}`}
                          className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-semibold text-primary/80 hover:bg-surface"
                        >
                          Manage availability
                        </Link>
                      ) : null}
                      <RowActions row={row} pending={pending} run={run} onDone={applyResult} />
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selected ? (
        <aside className="rounded-[24px] border border-primary/10 bg-white p-5 sm:p-6">
          <h2 className="text-xl font-bold text-primary">Relationship detail</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
            <Detail label="Coach" value={selected.coach?.name} />
            <Detail label="Venue" value={selected.venue?.name} />
            <Detail
              label="Status"
              value={COACH_VENUE_STATUS_LABELS[selected.status as CoachVenueStatus]}
            />
            <Detail
              label="Initiated by"
              value={COACH_VENUE_INITIATOR_LABELS[selected.initiated_by]}
            />
            <Detail label="Requester" value={selected.requesterLabel} />
            <Detail label="Responder" value={selected.responderLabel} />
            <Detail label="Requested" value={formatDate(selected.requested_at)} />
            <Detail label="Responded" value={formatDate(selected.responded_at)} />
            <Detail label="Ended" value={formatDate(selected.ended_at)} />
            <Detail label="Primary" value={selected.is_primary ? "Yes" : "No"} />
          </dl>
          {selected.status === "unverified" && selected.initiated_by === "import" ? (
            <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Imported association from legacy data. Verify to confirm, or remove if
              incorrect. This is not a mutually accepted request.
            </p>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-xl bg-surface/70 px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-primary/45">
        {label}
      </dt>
      <dd className="mt-1 font-medium text-primary">{value || "—"}</dd>
    </div>
  );
}

function RowActions({
  row,
  pending,
  run,
  onDone,
}: {
  row: AdminRelationshipListItem;
  pending: boolean;
  run: (action: () => Promise<{ ok: boolean; message: string }>) => void;
  onDone: (result: { ok: boolean; message: string }) => void;
}) {
  if (row.status === "pending") {
    return (
      <>
        <ActionButton
          pending={pending}
          onClick={() => run(() => adminApproveCoachVenueRelationship(row.id))}
        >
          Approve
        </ActionButton>
        <ConfirmActionButton
          label="Decline"
          confirmLabel="Confirm decline"
          onConfirm={() => adminDeclineCoachVenueRelationship(row.id)}
          onDone={onDone}
        />
        <ConfirmActionButton
          label="Cancel"
          confirmLabel="Confirm cancel"
          tone="neutral"
          onConfirm={() => adminCancelCoachVenueRelationship(row.id)}
          onDone={onDone}
        />
      </>
    );
  }

  if (row.status === "unverified") {
    return (
      <>
        <ActionButton
          pending={pending}
          onClick={() =>
            run(() => adminVerifyImportedCoachVenueRelationship(row.id))
          }
        >
          Verify
        </ActionButton>
        <ConfirmActionButton
          label="Remove"
          confirmLabel="Confirm remove"
          onConfirm={() => adminRemoveImportedCoachVenueRelationship(row.id)}
          onDone={onDone}
        />
        <ActionButton
          tone="secondary"
          pending={pending}
          onClick={() =>
            run(() => adminSetPrimaryCoachVenue(row.id, !row.is_primary))
          }
        >
          {row.is_primary ? "Unset primary" : "Set primary"}
        </ActionButton>
      </>
    );
  }

  if (row.status === "active") {
    return (
      <>
        <ConfirmActionButton
          label="End"
          confirmLabel="Confirm end"
          onConfirm={() => adminEndCoachVenueRelationship(row.id)}
          onDone={onDone}
        />
        <ActionButton
          tone="secondary"
          pending={pending}
          onClick={() =>
            run(() => adminSetPrimaryCoachVenue(row.id, !row.is_primary))
          }
        >
          {row.is_primary ? "Unset primary" : "Set primary"}
        </ActionButton>
      </>
    );
  }

  return <span className="text-xs text-primary/45">Read-only</span>;
}

function AdminCreateRelationshipForm({
  pending,
  onCreated,
  startTransition,
}: {
  pending: boolean;
  onCreated: (result: { ok: boolean; message: string }) => void;
  startTransition: (fn: () => void) => void;
}) {
  const [mode, setMode] = useState<"active" | "imported">("active");
  const [isPrimary, setIsPrimary] = useState(false);
  const [coachTerm, setCoachTerm] = useState("");
  const [venueTerm, setVenueTerm] = useState("");
  const [coachResults, setCoachResults] = useState<AdminEntitySearchResult[]>([]);
  const [venueResults, setVenueResults] = useState<AdminEntitySearchResult[]>([]);
  const [coach, setCoach] = useState<AdminEntitySearchResult | null>(null);
  const [venue, setVenue] = useState<AdminEntitySearchResult | null>(null);

  useEffect(() => {
    if (coachTerm.trim().length < 2) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void searchAdminCoachesForRelationshipAction(coachTerm).then((res) => {
        if (cancelled || !res.ok) return;
        setCoachResults(res.results);
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [coachTerm]);

  useEffect(() => {
    if (venueTerm.trim().length < 2) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void searchAdminVenuesForRelationshipAction(venueTerm).then((res) => {
        if (cancelled || !res.ok) return;
        setVenueResults(res.results);
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [venueTerm]);

  return (
    <section className="rounded-[24px] border border-primary/10 bg-white p-5 sm:p-6">
      <h2 className="text-xl font-bold text-primary">Create relationship</h2>
      <p className="mt-1 text-sm text-primary/60">
        Create a confirmed active link or an imported unverified association.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <ActionButton
          tone={mode === "active" ? "primary" : "secondary"}
          pending={pending}
          onClick={() => setMode("active")}
        >
          Active (admin)
        </ActionButton>
        <ActionButton
          tone={mode === "imported" ? "primary" : "secondary"}
          pending={pending}
          onClick={() => setMode("imported")}
        >
          Imported (unverified)
        </ActionButton>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <EntitySearch
          label="Coach"
          term={coachTerm}
          onTermChange={(value) => {
            setCoach(null);
            setCoachTerm(value);
            if (value.trim().length < 2) setCoachResults([]);
          }}
          results={coachResults}
          selected={coach}
          onSelect={setCoach}
        />
        <EntitySearch
          label="Venue"
          term={venueTerm}
          onTermChange={(value) => {
            setVenue(null);
            setVenueTerm(value);
            if (value.trim().length < 2) setVenueResults([]);
          }}
          results={venueResults}
          selected={venue}
          onSelect={setVenue}
        />
      </div>

      <label className="mt-4 inline-flex items-center gap-2 text-sm text-primary/80">
        <input
          type="checkbox"
          checked={isPrimary}
          onChange={(e) => setIsPrimary(e.target.checked)}
        />
        Set as primary venue for this coach
      </label>

      <div className="mt-4">
        <ActionButton
          pending={pending || !coach || !venue}
          onClick={() => {
            if (!coach || !venue) return;
            startTransition(() => {
              void adminCreateCoachVenueRelationship({
                coachId: coach.id,
                venueId: venue.id,
                mode,
                isPrimary,
              }).then((result) => {
                if (result.ok) {
                  setCoach(null);
                  setVenue(null);
                  setCoachTerm("");
                  setVenueTerm("");
                  setIsPrimary(false);
                }
                onCreated(result);
              });
            });
          }}
        >
          Create {mode === "active" ? "active" : "imported"} relationship
        </ActionButton>
      </div>
    </section>
  );
}

function EntitySearch({
  label,
  term,
  onTermChange,
  results,
  selected,
  onSelect,
}: {
  label: string;
  term: string;
  onTermChange: (value: string) => void;
  results: AdminEntitySearchResult[];
  selected: AdminEntitySearchResult | null;
  onSelect: (value: AdminEntitySearchResult) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-primary">
        {label}
        <input
          type="search"
          value={term}
          onChange={(e) => onTermChange(e.target.value)}
          className="mt-2 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2.5 text-sm font-normal"
          placeholder={`Search ${label.toLowerCase()}`}
        />
      </label>
      {selected ? (
        <p className="mt-2 text-sm text-primary/70">
          Selected: <span className="font-semibold text-primary">{selected.name}</span>
        </p>
      ) : null}
      {results.length > 0 ? (
        <ul className="mt-2 max-h-48 overflow-auto rounded-xl border border-primary/10">
          {results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item)}
                className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-surface"
              >
                <span className="font-semibold text-primary">{item.name}</span>
                {item.secondary ? (
                  <span className="text-xs text-primary/50">{item.secondary}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
