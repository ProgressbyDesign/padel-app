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
} from "@/lib/coachVenues/types";
import { formatInTimeZone } from "@/lib/coachAvailability/timezone";

function statusTone(status: string) {
  if (status === "active") return "green" as const;
  if (status === "unverified" || status === "pending") return "amber" as const;
  if (status === "declined") return "red" as const;
  return "neutral" as const;
}

export default function VenueCoachesManager({
  venueId,
  board,
  availability = {},
}: {
  venueId: string;
  board: CoachVenueBoard;
  availability?: Record<
    string,
    {
      configured: boolean;
      isPublic: boolean;
      timezone: string | null;
      nextSlotStartsAt: string | null;
    }
  >;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
        }
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [venueId, term]);

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
        <h2 className="text-xl font-bold text-primary">Invite coach</h2>
        <p className="mt-1 text-sm text-primary/60">
          Search existing coaches and invite them to coach at this venue.
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
            <div className="mt-3 flex flex-wrap gap-2">
              <ActionButton
                pending={pending}
                onClick={() =>
                  run(() => inviteCoachToVenue(venueId, selected.id), true)
                }
              >
                Send invitation
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
          const hint = availability[row.id];
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
              row.status === "active"
                ? hint?.configured
                  ? `${hint.isPublic ? "Public" : "Private"} availability${
                      hint.nextSlotStartsAt && hint.timezone
                        ? ` · next ${formatInTimeZone(
                            hint.nextSlotStartsAt,
                            hint.timezone,
                            {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                              hourCycle: "h23",
                            }
                          )}`
                        : ""
                    }`
                  : "No availability set"
                : undefined
            }
            actions={
              <>
                {row.status === "active" && row.coach ? (
                  <Link
                    href={`/account/venues/${encodeURIComponent(venueId)}/coaches/${encodeURIComponent(row.coach.id)}/availability`}
                    className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-semibold text-primary/80 hover:bg-surface"
                  >
                    View schedule
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
  availabilityNote?: string;
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
            {availabilityNote ? (
              <p className="mt-1 text-xs text-primary/65">{availabilityNote}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </li>
  );
}
