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
} from "@/lib/coachVenues/constants";
import type {
  CoachVenueBoard,
  CoachVenueRelationship,
  CoachVenueSearchVenue,
} from "@/lib/coachVenues/types";

function locationLabel(row: CoachVenueRelationship) {
  return [row.venue?.city, row.venue?.country]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

function statusTone(status: string) {
  if (status === "active") return "green" as const;
  if (status === "unverified" || status === "pending") return "amber" as const;
  if (status === "declined") return "red" as const;
  return "neutral" as const;
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
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<CoachVenueSearchVenue[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<CoachVenueSearchVenue | null>(null);

  useEffect(() => {
    if (term.trim().length < 2) {
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
  }, [coachId, term]);

  function applyResult(result: { ok: boolean; message: string }) {
    if (result.ok) {
      setFeedback(result.message);
      setError(null);
      router.refresh();
    } else {
      setError(result.message);
    }
  }

  function run(
    action: () => Promise<{ ok: boolean; message: string }>,
    clearSelection = false
  ) {
    setFeedback(null);
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok && clearSelection) {
        setSelected(null);
        setTerm("");
        setResults([]);
      }
      applyResult(result);
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

      <section className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-6">
        <h2 className="text-xl font-bold text-primary">Add coaching venue</h2>
        <p className="mt-1 text-sm text-primary/60">
          Search for a venue and send a coaching relationship request. You do not
          need to own the venue.
        </p>

        <label className="mt-5 block text-sm font-semibold text-primary">
          Search venues
          <input
            type="search"
            value={term}
            onChange={(e) => {
              setSelected(null);
              setTerm(e.target.value);
              if (e.target.value.trim().length < 2) setResults([]);
            }}
            placeholder="Name, city, or country"
            className="mt-2 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2.5 text-sm font-normal text-primary outline-none focus:border-primary/40"
          />
        </label>

        {searching ? <p className="mt-3 text-sm text-primary/50">Searching…</p> : null}

        {results.length > 0 ? (
          <ul className="mt-4 divide-y divide-primary/10 rounded-2xl border border-primary/10">
            {results.map((venue) => {
              const blocked = Boolean(venue.existingStatus);
              return (
                <li
                  key={venue.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3"
                >
                  <div>
                    <p className="font-semibold text-primary">{venue.name}</p>
                    <p className="text-sm text-primary/55">
                      {[venue.city, venue.country].filter(Boolean).join(", ") ||
                        "Location not set"}
                    </p>
                    {blocked ? (
                      <p className="mt-1 text-xs text-amber-800">
                        Existing: {COACH_VENUE_STATUS_LABELS[venue.existingStatus!]}
                      </p>
                    ) : null}
                  </div>
                  <ActionButton
                    tone="secondary"
                    pending={pending || blocked}
                    onClick={() => {
                      if (!blocked) setSelected(venue);
                    }}
                  >
                    {blocked
                      ? "Unavailable"
                      : selected?.id === venue.id
                        ? "Selected"
                        : "Select"}
                  </ActionButton>
                </li>
              );
            })}
          </ul>
        ) : null}

        {selected ? (
          <div className="mt-4 rounded-2xl border border-primary/10 bg-surface/70 p-4">
            <p className="text-sm text-primary/70">
              Request a coaching relationship with{" "}
              <span className="font-semibold text-primary">{selected.name}</span>?
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <ActionButton
                pending={pending}
                onClick={() =>
                  run(() => requestCoachVenueRelationship(coachId, selected.id), true)
                }
              >
                Send request
              </ActionButton>
              <ActionButton
                tone="secondary"
                pending={pending}
                onClick={() => setSelected(null)}
              >
                Clear
              </ActionButton>
            </div>
          </div>
        ) : null}
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
            meta={`Via ${COACH_VENUE_INITIATOR_LABELS[row.initiated_by]}`}
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
                    Imported association — awaiting verification. Choose an active
                    venue as primary after an admin verifies this link.
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
