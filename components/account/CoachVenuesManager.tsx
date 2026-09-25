"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Star, Plus, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
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
  RelationshipActionResult,
} from "@/lib/coachVenues/types";

type LocalVenueSelection = CoachVenueSearchVenue & {
  error?: string | null;
  relationshipId?: string;
  alreadyConnected?: boolean;
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selections, setSelections] = useState<LocalVenueSelection[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<CoachVenueSearchVenue[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!pickerOpen) return;
    dialogRef.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, [pickerOpen]);
  useEffect(() => {
    if (!pickerOpen) {
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
      }).catch(() => { if (!cancelled) { setSearching(false); setError("Venue search failed. Please try again."); } });
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
    dialogRef.current?.close();
    setPickerOpen(false);
    setTerm("");
    setResults([]);
  }

  function addVenue(venue: CoachVenueSearchVenue) {
    if (isBlockedForSelection(venue, selections)) return;
    setSelections((prev) => [...prev, { ...venue, error: null }]);
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
      let connectedCount = 0;
      let requestedCount = 0;

      for (const venue of selections) {
        let result: RelationshipActionResult;
        try {
          result = await requestCoachVenueRelationship(coachId, venue.id);
        } catch {
          result = { ok: false, message: "Could not save this venue. Please try again." };
        }
        if (result.ok) {
          if (result.activatedImmediately) connectedCount += 1;
          else requestedCount += 1;
        } else {
          remaining.push({
            ...venue,
            error: result.message,
            relationshipId: result.relationshipId,
            alreadyConnected: result.alreadyConnected,
          });
        }
      }

      setSelections(remaining);
      if (remaining.length === 0) closePicker();

      const successCount = connectedCount + requestedCount;
      if (successCount > 0) {
        const parts: string[] = [];
        if (connectedCount > 0) {
          parts.push(
            connectedCount === 1
              ? "Connected 1 venue."
              : `Connected ${connectedCount} venues.`
          );
        }
        if (requestedCount > 0) {
          parts.push(
            requestedCount === 1
              ? "Sent 1 venue request."
              : `Sent ${requestedCount} venue requests.`
          );
        }
        setFeedback(parts.join(" "));
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

      <button type="button" onClick={() => { setPickerOpen(true); setError(null); }} className="group flex min-h-60 w-full flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-primary/20 bg-white p-8 text-center transition hover:border-primary/50 hover:bg-surface">
        <span className="relative rounded-2xl bg-accent/25 p-5"><Building2 className="h-10 w-10" aria-hidden /><Plus className="absolute -right-2 -top-2 h-8 w-8 rounded-full bg-primary p-1.5 text-accent" aria-hidden /></span>
        <span className="text-2xl font-semibold">Add venue</span>
        <span className="max-w-md text-sm text-primary/65">Choose where you coach. Find your club in our venue catalogue and add it to your coaching locations.</span>
      </button>
      {pickerOpen ? <dialog ref={dialogRef} aria-labelledby="venue-picker-title" onCancel={(event) => { event.preventDefault(); if (!pending) closePicker(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-3xl overflow-y-auto rounded-3xl bg-white p-0 text-primary shadow-2xl backdrop:bg-primary/60">
        <div className="sticky top-0 z-10 border-b border-primary/10 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4"><h2 id="venue-picker-title" className="text-2xl">Add coaching venues</h2><button type="button" aria-label="Close venue picker" disabled={pending} onClick={closePicker} className="rounded-full p-2 hover:bg-surface"><X /></button></div>
          <p className="mt-2 text-sm text-primary/65">Browse our catalogue, including venues not yet listed publicly. Requests need venue or admin approval unless you manage both profiles.</p>
          <label className="mt-4 block text-sm font-semibold">Search venues<input autoFocus type="search" value={term} onChange={e => setTerm(e.target.value)} placeholder="Venue name, city or country" className="mt-2 w-full rounded-xl border border-primary/20 p-3 font-normal" /></label>
        </div>
        <div className="p-5 sm:p-6">
          {error ? <p role="alert" className="mb-3 text-sm text-red-800">{error}</p> : null}
          {selections.length ? <ul className="mb-5 flex flex-wrap gap-2">{selections.map(venue => <li key={venue.id} className="rounded-xl bg-surface p-3 text-sm"><button type="button" disabled={pending} onClick={() => removeSelection(venue.id)} aria-label={`Remove ${venue.name}`}>{venue.name} ×</button>{venue.error ? <p className="mt-1 text-red-800">{venue.error}</p> : null}</li>)}</ul> : null}
          {searching ? <p role="status" className="text-sm">Searching…</p> : null}
          <ul className="divide-y divide-primary/10">{results.map(venue => { const selected = selections.some(row => row.id === venue.id); const connected = Boolean(venue.existingStatus && isCurrentCoachVenueStatus(venue.existingStatus)); return <li key={venue.id}><label className={`flex items-center gap-4 py-4 ${connected ? "opacity-50" : "cursor-pointer"}`}><input type="checkbox" checked={selected || connected} disabled={pending || connected} onChange={() => selected ? removeSelection(venue.id) : addVenue(venue)} className="h-5 w-5 accent-primary" /><Building2 className="h-8 w-8 shrink-0 text-primary/40" /><span><span className="block font-semibold">{venue.name}</span><span className="text-sm text-primary/60">{searchLocationLabel(venue)}{connected ? " · Already added" : ""}</span></span></label></li>; })}</ul>
          {!results.length && !searching ? <p className="py-6 text-sm text-primary/65">No venues found. Try a different name or location.</p> : null}
        </div>
        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-primary/10 bg-white p-5"><p className="text-sm">{requestCount} selected</p><div className="flex gap-3"><ActionButton tone="secondary" pending={pending} onClick={closePicker}>Cancel</ActionButton><ActionButton pending={pending || !requestCount} onClick={sendVenueRequests}>{pending ? "Saving…" : "Save selected venues"}</ActionButton></div></div>
      </dialog> : null}

      <RelationshipSection
        title="Current venues"
        empty="No current venue relationships."
        items={board.current}
        renderItem={(row) => (
          <RelationshipCard
            key={row.id}
            title={row.venue?.name ?? "Venue"}
            subtitle={locationLabel(row)}
            href={undefined}
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
            href={undefined}
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
            href={undefined}
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
            href={undefined}
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
  items,
  renderItem,
}: {
  title: string;
  empty: string;
  items: CoachVenueRelationship[];
  renderItem: (row: CoachVenueRelationship) => ReactNode;
}) {
  if (!items.length) return null;
  return (
    <section className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-6">
      <h2 className="text-xl text-primary">{title}</h2>
      <ul className="mt-4 space-y-3">{items.map(renderItem)}</ul>
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
