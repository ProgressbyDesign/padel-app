"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Star } from "lucide-react";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import {
  acceptCoachVenueRelationship,
  cancelCoachVenueRelationship,
  declineCoachVenueRelationship,
  endCoachVenueRelationship,
  requestCoachVenueRelationship,
  searchVenuesForCoachRelationshipAction,
  setPrimaryCoachVenue,
} from "@/app/account/coaches/[coachId]/venue-actions";
import {
  ActionButton,
  ConfirmActionButton,
  StatusBadge,
} from "@/components/account/RelationshipActionControls";
import {
  COACH_VENUE_INITIATOR_LABELS,
  COACH_VENUE_STATUS_LABELS,
  isCurrentCoachVenueStatus,
} from "@/lib/coachVenues/constants";
import type {
  CoachVenueBoard,
  CoachVenueRelationship,
  CoachVenueSearchVenue,
} from "@/lib/coachVenues/types";

type LocalVenueSelection = CoachVenueSearchVenue & {
  error?: string | null;
};

function locationLabel(row: CoachVenueRelationship) {
  return [row.venue?.city, row.venue?.country]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

function searchLocationLabel(venue: CoachVenueSearchVenue) {
  return [venue.city, venue.country].filter(Boolean).join(", ") || "Location not set";
}

function statusTone(status: string) {
  if (status === "active") return "green" as const;
  if (status === "unverified" || status === "pending") return "amber" as const;
  if (status === "declined") return "red" as const;
  return "neutral" as const;
}

function isBlockedForSelection(
  venue: CoachVenueSearchVenue,
  selections: LocalVenueSelection[]
) {
  if (venue.existingStatus && isCurrentCoachVenueStatus(venue.existingStatus)) {
    return true;
  }
  return selections.some((row) => row.id === venue.id);
}

export default function CoachVenuesManager({
  coachId,
  board,
}: {
  coachId: string;
  board: CoachVenueBoard;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selections, setSelections] = useState<LocalVenueSelection[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<CoachVenueSearchVenue[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!pickerOpen || term.trim().length < 2) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      void searchVenuesForCoachRelationshipAction(coachId, term).then((res) => {
        if (cancelled) return;
        setSearching(false);
        if (res.ok) setResults(res.venues);
        else {
          setResults([]);
          setError(res.message);
        }
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [coachId, term, pickerOpen]);

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

  function closePicker() {
    setPickerOpen(false);
    setTerm("");
    setResults([]);
  }

  function addVenue(venue: CoachVenueSearchVenue) {
    if (isBlockedForSelection(venue, selections)) return;
    setSelections((prev) => [...prev, { ...venue, error: null }]);
    closePicker();
    setError(null);
  }

  function removeSelection(venueId: string) {
    setSelections((prev) => prev.filter((row) => row.id !== venueId));
  }

  function sendVenueRequests() {
    if (selections.length === 0) return;
    setFeedback(null);
    setError(null);
    startTransition(async () => {
      const remaining: LocalVenueSelection[] = [];
      let successCount = 0;

      for (const venue of selections) {
        const result = await requestCoachVenueRelationship(coachId, venue.id);
        if (result.ok) {
          successCount += 1;
        } else {
          remaining.push({ ...venue, error: result.message });
        }
      }

      setSelections(remaining);

      if (successCount > 0) {
        setFeedback(
          successCount === 1
            ? "Sent 1 venue request."
            : `Sent ${successCount} venue requests.`
        );
        router.refresh();
      }

      if (remaining.length > 0 && successCount === 0) {
        setError("Venue requests could not be sent. See errors below.");
      } else if (remaining.length > 0) {
        setError(
          `${remaining.length} request${remaining.length === 1 ? "" : "s"} failed. Fix or remove them below.`
        );
      }
    });
  }

  const requestCount = selections.length;

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

      <section className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-6">
        <h2 className="text-xl font-bold text-primary">Add coaching venues</h2>
        <p className="mt-1 text-sm text-primary/60">
          Select one or more venues, then send coaching relationship requests.
          You do not need to own the venue.
        </p>

        {selections.length > 0 ? (
          <ul className="mt-5 space-y-3">
            {selections.map((venue) => (
              <li
                key={venue.id}
                className="rounded-2xl border border-primary/10 bg-surface/70 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-primary">{venue.name}</p>
                    <p className="mt-1 text-sm text-primary/55">
                      {searchLocationLabel(venue)}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-emerald-800">
                      Ready to request
                    </p>
                    {venue.error ? (
                      <p className="mt-2 text-xs text-red-800" role="alert">
                        {venue.error}
                      </p>
                    ) : null}
                  </div>
                  <ActionButton
                    tone="secondary"
                    pending={pending}
                    onClick={() => removeSelection(venue.id)}
                  >
                    Remove
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 text-sm text-primary/55">
            No venues selected yet. Add a venue to prepare a request.
          </p>
        )}

        <div className="mt-5 space-y-3">
          {pickerOpen ? (
            <div className="rounded-2xl border border-primary/10 bg-surface/50 p-4">
              <label className="block text-sm font-semibold text-primary">
                Search venues
                <input
                  type="search"
                  value={term}
                  autoFocus
                  onChange={(e) => {
                    setTerm(e.target.value);
                    if (e.target.value.trim().length < 2) setResults([]);
                  }}
                  placeholder="Name, city, or country"
                  className="mt-2 w-full rounded-xl border border-primary/15 bg-white px-3 py-2.5 text-sm font-normal text-primary outline-none focus:border-primary/40"
                />
              </label>

              {searching ? (
                <p className="mt-3 text-sm text-primary/50">Searching…</p>
              ) : null}

              {results.length > 0 ? (
                <ul className="mt-4 divide-y divide-primary/10 rounded-2xl border border-primary/10 bg-white">
                  {results.map((venue) => {
                    const blocked = isBlockedForSelection(venue, selections);
                    return (
                      <li
                        key={venue.id}
                        className="flex flex-wrap items-center justify-between gap-3 p-3"
                      >
                        <div>
                          <p className="font-semibold text-primary">{venue.name}</p>
                          <p className="text-sm text-primary/55">
                            {searchLocationLabel(venue)}
                          </p>
                          {blocked ? (
                            <p className="mt-1 text-xs text-amber-800">
                              {venue.existingStatus
                                ? `Existing: ${COACH_VENUE_STATUS_LABELS[venue.existingStatus]}`
                                : "Already selected"}
                            </p>
                          ) : null}
                        </div>
                        <ActionButton
                          tone="secondary"
                          pending={pending || blocked}
                          onClick={() => addVenue(venue)}
                        >
                          {blocked ? "Unavailable" : "Add"}
                        </ActionButton>
                      </li>
                    );
                  })}
                </ul>
              ) : term.trim().length >= 2 && !searching ? (
                <p className="mt-3 text-sm text-primary/50">No venues found.</p>
              ) : null}

              <div className="mt-3">
                <ActionButton
                  tone="secondary"
                  pending={pending}
                  onClick={closePicker}
                >
                  Cancel
                </ActionButton>
              </div>
            </div>
          ) : (
            <ActionButton
              tone="secondary"
              pending={pending}
              onClick={() => setPickerOpen(true)}
            >
              + Add another venue
            </ActionButton>
          )}

          <ActionButton
            pending={pending || requestCount === 0}
            onClick={sendVenueRequests}
          >
            {requestCount === 0
              ? "Send venue requests"
              : requestCount === 1
                ? "Send 1 venue request"
                : `Send ${requestCount} venue requests`}
          </ActionButton>
        </div>
      </section>

      <RelationshipSection
        title="Current venues"
        empty="No current venue relationships."
        items={board.current}
        renderItem={(row) => (
          <RelationshipCard
            key={row.id}
            title={row.venue?.name ?? "Venue"}
            subtitle={locationLabel(row)}
            href={row.venue ? `/venue/${row.venue.id}` : undefined}
            status={row.status}
            isPrimary={row.is_primary}
            meta={
              row.status === "unverified"
                ? "Imported association — awaiting verification"
                : `Via ${COACH_VENUE_INITIATOR_LABELS[row.initiated_by]}`
            }
            actions={
              <>
                {row.status === "active" ? (
                  <>
                    {!row.is_primary ? (
                      <ActionButton
                        tone="secondary"
                        pending={pending}
                        onClick={() => run(() => setPrimaryCoachVenue(row.id, true))}
                      >
                        Make primary
                      </ActionButton>
                    ) : (
                      <ActionButton
                        tone="secondary"
                        pending={pending}
                        onClick={() => run(() => setPrimaryCoachVenue(row.id, false))}
                      >
                        Remove primary
                      </ActionButton>
                    )}
                    <ConfirmActionButton
                      label="End relationship"
                      confirmLabel="Confirm end"
                      onConfirm={() => endCoachVenueRelationship(row.id)}
                      onDone={applyResult}
                    />
                  </>
                ) : null}
                {row.status === "unverified" ? (
                  <p className="max-w-sm text-xs leading-5 text-amber-900">
                    This is an imported venue link and is not yet verified. Choose an
                    active venue as primary after an admin verifies this association.
                    {row.is_primary
                      ? " This imported link is currently marked primary."
                      : ""}
                  </p>
                ) : null}
              </>
            }
          />
        )}
      />

      <RelationshipSection
        title="Incoming venue invitations"
        empty="No venue invitations waiting for a response."
        items={board.incoming}
        renderItem={(row) => (
          <RelationshipCard
            key={row.id}
            title={row.venue?.name ?? "Venue"}
            subtitle={locationLabel(row)}
            href={row.venue ? `/venue/${row.venue.id}` : undefined}
            status={row.status}
            actions={
              <>
                <ActionButton
                  pending={pending}
                  onClick={() => run(() => acceptCoachVenueRelationship(row.id))}
                >
                  Accept
                </ActionButton>
                <ConfirmActionButton
                  label="Decline"
                  confirmLabel="Confirm decline"
                  onConfirm={() => declineCoachVenueRelationship(row.id)}
                  onDone={applyResult}
                />
              </>
            }
          />
        )}
      />

      <RelationshipSection
        title="Sent venue requests"
        empty="No open venue requests."
        items={board.outgoing}
        renderItem={(row) => (
          <RelationshipCard
            key={row.id}
            title={row.venue?.name ?? "Venue"}
            subtitle={locationLabel(row)}
            href={row.venue ? `/venue/${row.venue.id}` : undefined}
            status={row.status}
            actions={
              <ConfirmActionButton
                label="Cancel request"
                confirmLabel="Confirm cancel"
                onConfirm={() => cancelCoachVenueRelationship(row.id)}
                onDone={applyResult}
              />
            }
          />
        )}
      />

      <RelationshipSection
        title="Past relationships"
        empty="No past relationships yet."
        items={board.past}
        renderItem={(row) => (
          <RelationshipCard
            key={row.id}
            title={row.venue?.name ?? "Venue"}
            subtitle={locationLabel(row)}
            href={row.venue ? `/venue/${row.venue.id}` : undefined}
            status={row.status}
            meta={`Via ${COACH_VENUE_INITIATOR_LABELS[row.initiated_by]}`}
          />
        )}
      />
    </div>
  );
}

function RelationshipSection({
  title,
  empty,
  items,
  renderItem,
}: {
  title: string;
  empty: string;
  items: CoachVenueRelationship[];
  renderItem: (row: CoachVenueRelationship) => ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-6">
      <h2 className="text-xl font-bold text-primary">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-primary/55">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-3">{items.map(renderItem)}</ul>
      )}
    </section>
  );
}

function RelationshipCard({
  title,
  subtitle,
  href,
  status,
  isPrimary,
  meta,
  actions,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  status: CoachVenueRelationship["status"];
  isPrimary?: boolean;
  meta?: string;
  actions?: ReactNode;
}) {
  return (
    <li className="rounded-2xl border border-primary/10 bg-surface/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Building2 className="h-4 w-4 text-primary/40" aria-hidden />
            {href ? (
              <Link href={href} className="font-semibold text-primary hover:underline">
                {title}
              </Link>
            ) : (
              <p className="font-semibold text-primary">{title}</p>
            )}
            {isPrimary ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/40 px-2 py-0.5 text-[11px] font-semibold text-primary">
                <Star className="h-3 w-3" aria-hidden /> Primary
              </span>
            ) : null}
            <StatusBadge tone={statusTone(status)}>
              {COACH_VENUE_STATUS_LABELS[status]}
            </StatusBadge>
          </div>
          {subtitle ? <p className="mt-1 text-sm text-primary/55">{subtitle}</p> : null}
          {meta ? <p className="mt-1 text-xs text-primary/45">{meta}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </li>
  );
}
