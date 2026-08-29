"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star, UserRound } from "lucide-react";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import {
  acceptVenueCoachRelationship,
  cancelVenueCoachInvitation,
  declineVenueCoachRelationship,
  endVenueCoachRelationship,
  inviteCoachToVenue,
  searchCoachesForVenueRelationshipAction,
} from "@/app/account/venues/[venueId]/coach-actions";
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
  CoachVenueSearchCoach,
  RelationshipActionResult,
} from "@/lib/coachVenues/types";
import { formatInTimeZone } from "@/lib/coachAvailability/timezone";
import { coachHealthLabel } from "@/lib/venueOperations/coachHealth";
import type { CoachAvailabilityHealth } from "@/lib/venueOperations/types";

function statusTone(status: string) {
  if (status === "active") return "green" as const;
  if (status === "unverified" || status === "pending") return "amber" as const;
  if (status === "declined") return "red" as const;
  return "neutral" as const;
}

export default function VenueCoachesManager({
  venueId,
  venueName,
  board,
  health = {},
}: {
  venueId: string;
  venueName: string;
  board: CoachVenueBoard;
  health?: Record<string, CoachAvailabilityHealth>;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorLink, setErrorLink] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<CoachVenueSearchCoach[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<CoachVenueSearchCoach | null>(null);

  useEffect(() => {
    if (term.trim().length < 2) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      void searchCoachesForVenueRelationshipAction(venueId, term).then((res) => {
        if (cancelled) return;
        setSearching(false);
        if (res.ok) setResults(res.coaches);
        else {
          setResults([]);
          setError(res.message);
          setErrorLink(null);
        }
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [venueId, term]);

  function applyResult(result: RelationshipActionResult, coachIdForLink?: string) {
    if (result.ok) {
      setFeedback(result.message);
      setError(null);
      setErrorLink(null);
      router.refresh();
    } else {
      setError(result.message);
      if (result.alreadyConnected && coachIdForLink) {
        setErrorLink(
          `/account/venues/${encodeURIComponent(venueId)}/coaches/${encodeURIComponent(coachIdForLink)}/availability`
        );
      } else {
        setErrorLink(null);
      }
    }
  }

  function run(
    action: () => Promise<RelationshipActionResult>,
    clearSelection = false,
    coachIdForLink?: string
  ) {
    setFeedback(null);
    setError(null);
    setErrorLink(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok && clearSelection) {
        setSelected(null);
        setTerm("");
        setResults([]);
      }
      applyResult(result, coachIdForLink);
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
          <p>{error ?? feedback}</p>
          {error && errorLink ? (
            <Link
              href={errorLink}
              className="mt-2 inline-block text-sm font-semibold text-primary underline"
            >
              View availability
            </Link>
          ) : null}
        </div>
      )}

      <section className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-6">
        <h2 className="text-xl font-bold text-primary">Invite coach</h2>
        <p className="mt-1 text-sm text-primary/60">
          Search existing coaches and invite them to coach at {venueName}.
        </p>

        <label className="mt-5 block text-sm font-semibold text-primary">
          Search coaches
          <input
            type="search"
            value={term}
            onChange={(e) => {
              setSelected(null);
              setTerm(e.target.value);
              if (e.target.value.trim().length < 2) setResults([]);
            }}
            placeholder="Coach name"
            className="mt-2 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2.5 text-sm font-normal text-primary outline-none focus:border-primary/40"
          />
        </label>

        {searching ? <p className="mt-3 text-sm text-primary/50">Searching…</p> : null}

        {results.length > 0 ? (
          <ul className="mt-4 divide-y divide-primary/10 rounded-2xl border border-primary/10">
            {results.map((coach) => {
              const blocked = Boolean(coach.existingStatus);
              return (
                <li
                  key={coach.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <CoachAvatar name={coach.name} imageUrl={coach.image_url} />
                    <div className="min-w-0">
                      <p className="font-semibold text-primary">{coach.name}</p>
                      <p className="text-sm text-primary/55">
                        {[coach.role, coach.location].filter(Boolean).join(" · ") ||
                          "Profile details not set"}
                      </p>
                      {blocked ? (
                        <p className="mt-1 text-xs text-amber-800">
                          Existing: {COACH_VENUE_STATUS_LABELS[coach.existingStatus!]}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <ActionButton
                    tone="secondary"
                    pending={pending || blocked}
                    onClick={() => {
                      if (!blocked) setSelected(coach);
                    }}
                  >
                    {blocked
                      ? "Unavailable"
                      : selected?.id === coach.id
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
              Invite{" "}
              <span className="font-semibold text-primary">{selected.name}</span> to
              coach at this venue?
            </p>
            {selected.managedByCurrentUser ? (
              <p className="mt-2 text-xs font-semibold text-emerald-800">
                You manage both profiles. This coach will be connected
                immediately.
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <ActionButton
                pending={pending}
                onClick={() =>
                  run(
                    () => inviteCoachToVenue(venueId, selected.id),
                    true,
                    selected.id
                  )
                }
              >
                {selected.managedByCurrentUser
                  ? "Connect coach"
                  : "Send invitation"}
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
        title="Current coaches"
        empty="No current coach relationships."
        items={board.current}
        renderItem={(row) => {
          const rowHealth = health[row.id];
          return (
            <RelationshipCard
              key={row.id}
              title={row.coach?.name ?? "Coach"}
              subtitle={row.coach?.role ?? undefined}
              imageUrl={row.coach?.image_url}
              href={row.coach ? `/coach/${row.coach.id}` : undefined}
              status={row.status}
              isPrimary={row.is_primary}
              meta={`Via ${COACH_VENUE_INITIATOR_LABELS[row.initiated_by]}`}
              availabilityNote={
                row.status === "active" && rowHealth
                  ? renderActiveHealthNote(rowHealth, venueId)
                  : undefined
              }
              actions={
                <>
                  {row.status === "active" && row.coach ? (
                    <Link
                      href={`/account/venues/${encodeURIComponent(venueId)}/schedule?coach=${encodeURIComponent(row.coach.id)}`}
                      className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-semibold text-primary/80 hover:bg-surface"
                    >
                      View schedule
                    </Link>
                  ) : null}
                  {row.status === "active" && row.coach ? (
                    <Link
                      href={`/account/venues/${encodeURIComponent(venueId)}/coaches/${encodeURIComponent(row.coach.id)}/availability`}
                      className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-semibold text-primary/80 hover:bg-surface"
                    >
                      Availability
                    </Link>
                  ) : null}
                  {row.status === "active" ? (
                    <ConfirmActionButton
                      label="End relationship"
                      confirmLabel="Confirm end"
                      onConfirm={() => endVenueCoachRelationship(row.id)}
                      onDone={applyResult}
                    />
                  ) : null}
                  {row.status === "unverified" ? (
                    <p className="max-w-sm text-xs leading-5 text-amber-900">
                      Imported association — awaiting verification. Admin review is
                      required before this becomes a confirmed relationship.
                    </p>
                  ) : null}
                </>
              }
            />
          );
        }}
      />

      <RelationshipSection
        title="Incoming coach requests"
        empty="No coach requests waiting for a response."
        items={board.incoming}
        renderItem={(row) => (
          <RelationshipCard
            key={row.id}
            title={row.coach?.name ?? "Coach"}
            subtitle={row.coach?.role ?? undefined}
            imageUrl={row.coach?.image_url}
            href={row.coach ? `/coach/${row.coach.id}` : undefined}
            status={row.status}
            actions={
              <>
                <ActionButton
                  pending={pending}
                  onClick={() => run(() => acceptVenueCoachRelationship(row.id))}
                >
                  Accept
                </ActionButton>
                <ConfirmActionButton
                  label="Decline"
                  confirmLabel="Confirm decline"
                  onConfirm={() => declineVenueCoachRelationship(row.id)}
                  onDone={applyResult}
                />
              </>
            }
          />
        )}
      />

      <RelationshipSection
        title="Sent coach invitations"
        empty="No open coach invitations."
        items={board.outgoing}
        renderItem={(row) => (
          <RelationshipCard
            key={row.id}
            title={row.coach?.name ?? "Coach"}
            subtitle={row.coach?.role ?? undefined}
            imageUrl={row.coach?.image_url}
            href={row.coach ? `/coach/${row.coach.id}` : undefined}
            status={row.status}
            actions={
              <ConfirmActionButton
                label="Cancel invitation"
                confirmLabel="Confirm cancel"
                onConfirm={() => cancelVenueCoachInvitation(row.id)}
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
            title={row.coach?.name ?? "Coach"}
            subtitle={row.coach?.role ?? undefined}
            imageUrl={row.coach?.image_url}
            href={row.coach ? `/coach/${row.coach.id}` : undefined}
            status={row.status}
            meta={`Via ${COACH_VENUE_INITIATOR_LABELS[row.initiated_by]}`}
          />
        )}
      />
    </div>
  );
}

function renderActiveHealthNote(
  rowHealth: CoachAvailabilityHealth,
  venueId: string
): ReactNode {
  const tz = rowHealth.timezone ?? "UTC";
  const nextSlot =
    rowHealth.nextFutureSlotStartsAt && rowHealth.timezone
      ? formatInTimeZone(rowHealth.nextFutureSlotStartsAt, tz, {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        })
      : null;

  const visibility = !rowHealth.settingsConfigured
    ? null
    : rowHealth.isPublic
      ? "Public"
      : "Hidden";

  return (
    <div className="mt-2 space-y-1.5 text-xs text-primary/70">
      <p>
        <span className="font-semibold text-primary">
          {coachHealthLabel(rowHealth.state)}
        </span>
        {visibility ? (
          <span>
            {" "}
            · {visibility}
          </span>
        ) : null}
      </p>
      {rowHealth.state === "hidden" ? (
        <p>
          Schedule configured, but hidden from public booking. Only the coach can
          publish or change their availability.
        </p>
      ) : null}
      {rowHealth.state === "not_configured" ? (
        <p>
          The coach needs to configure availability in their workspace.
        </p>
      ) : null}
      {nextSlot ? <p>Next slot: {nextSlot}</p> : null}
      <p>
        Upcoming confirmed: {rowHealth.acceptedNext30Days}
        {" · "}
        Pending requests: {rowHealth.requestedAwaitingResponse}
      </p>
      <p>
        <Link
          href={`/account/venues/${encodeURIComponent(venueId)}/schedule?coach=${encodeURIComponent(rowHealth.coachId)}`}
          className="font-semibold text-primary underline"
        >
          View schedule
        </Link>
      </p>
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

function CoachAvatar({
  name,
  imageUrl,
}: {
  name: string;
  imageUrl: string | null;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- mixed remote coach image hosts
      <img
        src={imageUrl}
        alt=""
        width={40}
        height={40}
        className="h-10 w-10 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/5 text-primary/40">
      <UserRound className="h-4 w-4" aria-hidden />
      <span className="sr-only">{name}</span>
    </span>
  );
}

function RelationshipCard({
  title,
  subtitle,
  href,
  status,
  isPrimary,
  meta,
  availabilityNote,
  imageUrl,
  actions,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  status: CoachVenueRelationship["status"];
  isPrimary?: boolean;
  meta?: string;
  availabilityNote?: ReactNode;
  imageUrl?: string | null;
  actions?: ReactNode;
}) {
  return (
    <li className="rounded-2xl border border-primary/10 bg-surface/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <CoachAvatar name={title} imageUrl={imageUrl ?? null} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {href ? (
                <Link href={href} className="font-semibold text-primary hover:underline">
                  {title}
                </Link>
              ) : (
                <p className="font-semibold text-primary">{title}</p>
              )}
              {isPrimary ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/40 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  <Star className="h-3 w-3" aria-hidden /> Coach primary venue
                </span>
              ) : null}
              <StatusBadge tone={statusTone(status)}>
                {COACH_VENUE_STATUS_LABELS[status]}
              </StatusBadge>
            </div>
            {subtitle ? <p className="mt-1 text-sm text-primary/55">{subtitle}</p> : null}
            {meta ? <p className="mt-1 text-xs text-primary/45">{meta}</p> : null}
            {availabilityNote}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </li>
  );
}
