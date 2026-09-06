"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type RefObject,
} from "react";
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

type AvailabilityHint = {
  configured: boolean;
  isPublic: boolean;
  timezone: string | null;
  ruleCount: number;
  upcomingExceptionCount: number;
};

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

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}

function useEscapeToClose(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
}

function useLightFocusTrap(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  initialFocusRef?: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const focusTarget =
      initialFocusRef?.current ??
      container.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
    focusTarget?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener("keydown", onKeyDown);
    return () => {
      container.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, containerRef, initialFocusRef]);
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
  availability?: Record<string, AvailabilityHint>;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const detailsButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId]
  );

  const closeDrawer = useCallback(() => {
    setSelectedId(null);
  }, []);

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

  function openDetails(rowId: string) {
    setSelectedId(rowId);
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

      <div className="flex justify-end">
        <button
          ref={addButtonRef}
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-xl border border-primary/20 bg-white px-4 py-2.5 text-sm font-semibold text-primary hover:bg-surface"
        >
          [ Add relationship ]
        </button>
      </div>

      {createOpen ? (
        <AdminCreateRelationshipModal
          key="create-relationship-modal"
          open
          onClose={() => {
            setCreateOpen(false);
            addButtonRef.current?.focus();
          }}
          pending={pending}
          startTransition={startTransition}
          onCreated={(result) => {
            applyResult(result);
            if (result.ok) {
              setCreateOpen(false);
              addButtonRef.current?.focus();
            }
          }}
        />
      ) : null}

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
                  <tr
                    key={row.id}
                    className="cursor-pointer border-b border-primary/5 align-top hover:bg-surface/40"
                    onClick={() => openDetails(row.id)}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/coach/${row.coach_id}`}
                        className="font-semibold text-primary hover:underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {row.coach?.name ?? "Coach"}
                      </Link>
                      <p className="text-xs text-primary/45">{row.coach?.role}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/venue/${row.venue_id}`}
                        className="font-semibold text-primary hover:underline"
                        onClick={(event) => event.stopPropagation()}
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
                        <p className="text-xs text-primary/45">
                          {row.requesterLabel}
                        </p>
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
                            {hint.ruleCount} rules · {hint.upcomingExceptionCount}{" "}
                            exceptions
                          </p>
                        </>
                      ) : (
                        "Not configured"
                      )}
                    </td>
                    <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                      <div className="flex flex-wrap gap-2">
                        <ActionButton
                          ref={(node) => {
                            if (node) detailsButtonRefs.current.set(row.id, node);
                            else detailsButtonRefs.current.delete(row.id);
                          }}
                          tone="secondary"
                          pending={pending}
                          onClick={() => openDetails(row.id)}
                        >
                          Details
                        </ActionButton>
                        {row.status === "active" ? (
                          <Link
                            href={`/account/coaches/${row.coach_id}/availability/${row.id}`}
                            className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-semibold text-primary/80 hover:bg-surface"
                          >
                            Manage availability
                          </Link>
                        ) : null}
                        <RowActions
                          row={row}
                          pending={pending}
                          run={run}
                          onDone={applyResult}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <RelationshipDetailDrawer
        open={Boolean(selected)}
        row={selected}
        availability={selected ? availability[selected.id] : undefined}
        pending={pending}
        run={run}
        onDone={applyResult}
        onClose={() => {
          const returnId = selectedId;
          closeDrawer();
          if (returnId) {
            queueMicrotask(() => {
              detailsButtonRefs.current.get(returnId)?.focus();
            });
          }
        }}
      />
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
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

function availabilityLabel(
  row: AdminRelationshipListItem,
  hint: AvailabilityHint | undefined
) {
  if (row.status !== "active") return "—";
  if (!hint?.configured) return "Not configured";
  if (hint.isPublic) return "Public";
  return "Private";
}

function RelationshipDetailDrawer({
  open,
  row,
  availability,
  pending,
  run,
  onDone,
  onClose,
}: {
  open: boolean;
  row: AdminRelationshipListItem | null;
  availability: AvailabilityHint | undefined;
  pending: boolean;
  run: (action: () => Promise<{ ok: boolean; message: string }>) => void;
  onDone: (result: { ok: boolean; message: string }) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useBodyScrollLock(open);
  useEscapeToClose(open, onClose);
  useLightFocusTrap(open, panelRef, closeRef);

  if (!open || !row) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        className="absolute inset-0 bg-dark/40"
        aria-label="Close relationship details"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-0 flex w-full flex-col bg-white shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:max-w-md md:max-w-lg"
      >
        <div className="flex items-center justify-between border-b border-primary/10 px-5 py-4">
          <h2 id={titleId} className="text-lg text-primary">
            Relationship detail
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-lg border border-primary/15 px-3 py-1.5 text-sm font-semibold text-primary/80 hover:bg-surface"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <Detail label="Coach" value={row.coach?.name} />
            <Detail label="Venue" value={row.venue?.name} />
            <Detail
              label="Status"
              value={COACH_VENUE_STATUS_LABELS[row.status as CoachVenueStatus]}
            />
            <Detail
              label="Initiated by"
              value={COACH_VENUE_INITIATOR_LABELS[row.initiated_by]}
            />
            <Detail label="Primary" value={row.is_primary ? "Yes" : "No"} />
            <Detail label="Requested" value={formatDate(row.requested_at)} />
            <Detail label="Responded" value={formatDate(row.responded_at)} />
            <Detail label="Ended" value={formatDate(row.ended_at)} />
            <Detail
              label="Availability"
              value={availabilityLabel(row, availability)}
            />
            <Detail
              label="Availability detail"
              value={
                row.status !== "active"
                  ? "—"
                  : availability?.configured
                    ? `${availability.isPublic ? "Public" : "Private"}${
                        availability.timezone
                          ? ` · ${availability.timezone}`
                          : ""
                      } · ${availability.ruleCount} rules · ${
                        availability.upcomingExceptionCount
                      } exceptions`
                    : "Not configured"
              }
            />
            <Detail label="Related bookings" value="—" />
          </dl>

          {row.status === "unverified" && row.initiated_by === "import" ? (
            <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Imported association from legacy data. Verify to confirm, or remove
              if incorrect. This is not a mutually accepted request.
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2 border-t border-primary/10 pt-4">
            {row.status === "active" ? (
              <Link
                href={`/account/coaches/${row.coach_id}/availability/${row.id}`}
                className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-semibold text-primary/80 hover:bg-surface"
              >
                Manage availability
              </Link>
            ) : null}
            <RowActions
              row={row}
              pending={pending}
              run={run}
              onDone={onDone}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminCreateRelationshipModal({
  open,
  onClose,
  pending,
  onCreated,
  startTransition,
}: {
  open: boolean;
  onClose: () => void;
  pending: boolean;
  onCreated: (result: { ok: boolean; message: string }) => void;
  startTransition: (fn: () => void) => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState<"active" | "imported">("active");
  const [isPrimary, setIsPrimary] = useState(false);
  const [coachTerm, setCoachTerm] = useState("");
  const [venueTerm, setVenueTerm] = useState("");
  const [coachResults, setCoachResults] = useState<AdminEntitySearchResult[]>(
    []
  );
  const [venueResults, setVenueResults] = useState<AdminEntitySearchResult[]>(
    []
  );
  const [coach, setCoach] = useState<AdminEntitySearchResult | null>(null);
  const [venue, setVenue] = useState<AdminEntitySearchResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useBodyScrollLock(open);
  useEscapeToClose(open, onClose);
  useLightFocusTrap(open, panelRef, firstFieldRef);

  useEffect(() => {
    if (!open || coachTerm.trim().length < 2 || coach) {
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
  }, [coachTerm, coach, open]);

  useEffect(() => {
    if (!open || venueTerm.trim().length < 2 || venue) {
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
  }, [venueTerm, venue, open]);

  if (!open) return null;

  function resetForm() {
    setMode("active");
    setIsPrimary(false);
    setCoach(null);
    setVenue(null);
    setCoachTerm("");
    setVenueTerm("");
    setCoachResults([]);
    setVenueResults([]);
    setFormError(null);
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-dark/45"
        aria-label="Close create relationship dialog"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[min(92dvh,880px)] w-full max-w-2xl flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-primary/10 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg text-primary">
              Add relationship
            </h2>
            <p className="mt-1 text-sm text-primary/60">
              Create a confirmed active link or an imported unverified
              association.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-primary/15 px-3 py-1.5 text-sm font-semibold text-primary/80 hover:bg-surface"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {formError ? (
            <div
              role="alert"
              className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900"
            >
              {formError}
            </div>
          ) : null}

          <p className="text-xs font-semibold uppercase tracking-wide text-primary/50">
            Relationship type
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <ActionButton
              ref={firstFieldRef}
              tone={mode === "active" ? "primary" : "secondary"}
              pending={pending}
              onClick={() => setMode("active")}
            >
              Active (admin-created)
            </ActionButton>
            <ActionButton
              tone={mode === "imported" ? "primary" : "secondary"}
              pending={pending}
              onClick={() => setMode("imported")}
            >
              Imported (unverified)
            </ActionButton>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
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
              onSelect={(value) => {
                setCoach(value);
                setCoachTerm(value.name);
                setCoachResults([]);
              }}
              onClear={() => {
                setCoach(null);
                setCoachTerm("");
                setCoachResults([]);
              }}
              onChangeSelection={() => {
                setCoach(null);
                setCoachResults([]);
              }}
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
              onSelect={(value) => {
                setVenue(value);
                setVenueTerm(value.name);
                setVenueResults([]);
              }}
              onClear={() => {
                setVenue(null);
                setVenueTerm("");
                setVenueResults([]);
              }}
              onChangeSelection={() => {
                setVenue(null);
                setVenueResults([]);
              }}
            />
          </div>

          <label className="mt-5 inline-flex items-center gap-2 text-sm text-primary/80">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
            />
            Set as primary venue for this coach
          </label>

          <div className="mt-6 flex flex-wrap gap-2 border-t border-primary/10 pt-4">
            <ActionButton
              pending={pending || !coach || !venue}
              onClick={() => {
                if (!coach || !venue) return;
                setFormError(null);
                startTransition(() => {
                  void adminCreateCoachVenueRelationship({
                    coachId: coach.id,
                    venueId: venue.id,
                    mode,
                    isPrimary,
                  }).then((result) => {
                    if (result.ok) {
                      resetForm();
                      onCreated(result);
                    } else {
                      setFormError(result.message);
                      onCreated(result);
                    }
                  });
                });
              }}
            >
              Create {mode === "active" ? "active" : "imported"} relationship
            </ActionButton>
            <ActionButton tone="secondary" pending={pending} onClick={onClose}>
              Cancel
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function EntitySearch({
  label,
  term,
  onTermChange,
  results,
  selected,
  onSelect,
  onClear,
  onChangeSelection,
}: {
  label: string;
  term: string;
  onTermChange: (value: string) => void;
  results: AdminEntitySearchResult[];
  selected: AdminEntitySearchResult | null;
  onSelect: (value: AdminEntitySearchResult) => void;
  onClear: () => void;
  onChangeSelection: () => void;
}) {
  if (selected) {
    return (
      <div>
        <p className="text-sm font-semibold text-primary">{label}</p>
        <div className="mt-2 rounded-xl border border-primary/15 bg-surface px-3 py-3">
          <p className="font-semibold text-primary">{selected.name}</p>
          {selected.secondary ? (
            <p className="mt-0.5 text-xs text-primary/50">{selected.secondary}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onChangeSelection}
              className="rounded-lg border border-primary/15 px-2.5 py-1 text-xs font-semibold text-primary/80 hover:bg-white"
            >
              Change
            </button>
            <button
              type="button"
              onClick={onClear}
              className="rounded-lg border border-primary/15 px-2.5 py-1 text-xs font-semibold text-primary/80 hover:bg-white"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          autoComplete="off"
        />
      </label>
      {results.length > 0 ? (
        <ul className="mt-2 max-h-48 overflow-auto rounded-xl border border-primary/10 bg-white">
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
