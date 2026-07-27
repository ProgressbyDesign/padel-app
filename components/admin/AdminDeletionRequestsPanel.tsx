"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import {
  declineDeletionRequest,
  markProcessing,
  operationalCancel,
} from "@/app/admin/(ops)/account-deletions/actions";
import {
  ACCOUNT_DELETION_STATUS_LABELS,
  ACCOUNT_DELETION_STATUSES,
  type AccountDeletionStatus,
  type AdminDeletionRequestDetail,
  type DeletionActionResult,
} from "@/lib/accountDeletion/types";
import type { AdminDeletionListItem } from "@/lib/queries/accountDeletionRequests";
import { AdminBadge } from "@/components/admin/ui";

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function statusTone(
  status: AccountDeletionStatus
): "neutral" | "warn" | "ok" | "bad" {
  if (status === "requested") return "warn";
  if (status === "processing") return "neutral";
  if (status === "completed") return "ok";
  if (status === "declined") return "bad";
  return "neutral";
}

export function AdminDeletionRequestsPanel({
  rows,
  selectedStatuses,
}: {
  rows: AdminDeletionListItem[];
  selectedStatuses: AccountDeletionStatus[];
}) {
  return (
    <div className="space-y-6">
      <form className="rounded-2xl border border-primary/10 bg-white p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          {ACCOUNT_DELETION_STATUSES.map((status) => (
            <label
              key={status}
              className="flex items-center gap-2 text-sm text-primary/70"
            >
              <input
                type="checkbox"
                name="status"
                value={status}
                defaultChecked={selectedStatuses.includes(status)}
                className="h-4 w-4 rounded border-primary/20 accent-primary"
              />
              {ACCOUNT_DELETION_STATUS_LABELS[status]}
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

      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
        Completing account deletion requires a separate controlled cleanup
        process. Marking a request as processing does not delete the Auth user.
      </p>

      {rows.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-primary/20 bg-white p-10 text-center text-sm text-primary/55">
          No deletion requests match these filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-primary/10 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-primary/10 bg-surface text-xs uppercase tracking-wide text-primary/60">
                <th className="px-4 py-3 font-semibold">Requester</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Requested</th>
                <th className="px-4 py-3 font-semibold">Responsibilities</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-primary/5 last:border-0"
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-primary">
                      {row.profileName || "Unnamed account"}
                    </p>
                    <p className="text-primary/55">{row.requester_email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <AdminBadge tone={statusTone(row.status)}>
                      {ACCOUNT_DELETION_STATUS_LABELS[row.status]}
                    </AdminBadge>
                  </td>
                  <td className="px-4 py-3 text-primary/70">
                    {formatDate(row.requested_at)}
                  </td>
                  <td className="px-4 py-3 text-primary/70">
                    {row.responsibility.coachCount} coaches ·{" "}
                    {row.responsibility.venueCount} venues ·{" "}
                    {row.responsibility.futurePlayerBookings} player bookings ·{" "}
                    {row.responsibility.coachPendingBookings} coach pending
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/account-deletions/${row.id}`}
                      className="text-sm font-semibold text-primary hover:underline"
                    >
                      View details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AdminActionButton({
  label,
  pendingLabel,
  tone = "primary",
  onAction,
}: {
  label: string;
  pendingLabel: string;
  tone?: "primary" | "danger" | "neutral";
  onAction: () => Promise<DeletionActionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const styles =
    tone === "danger"
      ? "border border-red-200 bg-red-50 text-red-900 hover:bg-red-100"
      : tone === "neutral"
        ? "border border-primary/15 text-primary hover:bg-surface"
        : "bg-primary text-accent hover:bg-primary/90";

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await onAction();
            setMessage(result.message);
            if (result.ok) router.refresh();
          });
        }}
        className={`inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 ${styles}`}
      >
        {pending ? pendingLabel : label}
      </button>
      {message ? (
        <p className="text-xs text-primary/60" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function AdminDeletionRequestDetailPanel({
  detail,
}: {
  detail: AdminDeletionRequestDetail;
}) {
  const { request } = detail;
  const canProcess = request.status === "requested";
  const canDecline =
    request.status === "requested" || request.status === "processing";
  const canCancel =
    request.status === "requested" || request.status === "processing";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
        Completing account deletion requires a separate controlled cleanup
        process. Marking a request as processing does not delete the Auth user.
        There is no Completed action on this screen.
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-primary/10 bg-white p-5">
          <h2 className="text-lg font-bold text-primary">Request</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-primary/50">Status</dt>
              <dd className="mt-1">
                <AdminBadge tone={statusTone(request.status)}>
                  {ACCOUNT_DELETION_STATUS_LABELS[request.status]}
                </AdminBadge>
              </dd>
            </div>
            <div>
              <dt className="text-primary/50">Profile name</dt>
              <dd className="mt-1 font-medium text-primary">
                {detail.profileName || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-primary/50">Requester email</dt>
              <dd className="mt-1 font-medium text-primary">
                {request.requester_email}
              </dd>
            </div>
            <div>
              <dt className="text-primary/50">User ID</dt>
              <dd className="mt-1 break-all font-mono text-xs text-primary/70">
                {request.user_id}
              </dd>
            </div>
            <div>
              <dt className="text-primary/50">Reason</dt>
              <dd className="mt-1 text-primary/80">
                {request.reason?.trim() || "No reason provided"}
              </dd>
            </div>
            <div>
              <dt className="text-primary/50">Requested</dt>
              <dd className="mt-1">{formatDate(request.requested_at)}</dd>
            </div>
            {request.cancelled_at ? (
              <div>
                <dt className="text-primary/50">Cancelled</dt>
                <dd className="mt-1">{formatDate(request.cancelled_at)}</dd>
              </div>
            ) : null}
            {request.processed_at ? (
              <div>
                <dt className="text-primary/50">Processed</dt>
                <dd className="mt-1">{formatDate(request.processed_at)}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-primary/50">Account avatar</dt>
              <dd className="mt-1">
                {detail.hasAccountAvatar ? "Present" : "None"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-primary/10 bg-white p-5">
          <h2 className="text-lg font-bold text-primary">Admin actions</h2>
          <p className="mt-2 text-sm text-primary/60">
            These actions update request status and notify the user. They do not
            delete Auth users or run data cleanup.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {canProcess ? (
              <AdminActionButton
                label="Mark processing"
                pendingLabel="Updating…"
                onAction={() => markProcessing(request.id)}
              />
            ) : null}
            {canDecline ? (
              <AdminActionButton
                label="Decline"
                pendingLabel="Declining…"
                tone="danger"
                onAction={() => declineDeletionRequest(request.id)}
              />
            ) : null}
            {canCancel ? (
              <AdminActionButton
                label="Cancel operationally"
                pendingLabel="Cancelling…"
                tone="neutral"
                onAction={() => operationalCancel(request.id)}
              />
            ) : null}
            {!canProcess && !canDecline && !canCancel ? (
              <p className="text-sm text-primary/55">
                No further status actions are available for this request.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-primary/10 bg-white p-5">
          <h2 className="text-lg font-bold text-primary">Managed coaches</h2>
          {detail.coaches.length === 0 ? (
            <p className="mt-3 text-sm text-primary/55">None</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {detail.coaches.map((coach) => (
                <li key={coach.id}>
                  <Link
                    href={`/admin/coaches/${coach.id}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    {coach.name}
                  </Link>
                  {coach.membershipRole ? (
                    <span className="text-primary/50">
                      {" "}
                      · {coach.membershipRole}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-primary/10 bg-white p-5">
          <h2 className="text-lg font-bold text-primary">Managed venues</h2>
          {detail.venues.length === 0 ? (
            <p className="mt-3 text-sm text-primary/55">None</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {detail.venues.map((venue) => (
                <li key={venue.id}>
                  <Link
                    href={`/admin/venues/${venue.id}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    {venue.name}
                  </Link>
                  {venue.membershipRole ? (
                    <span className="text-primary/50">
                      {" "}
                      · {venue.membershipRole}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-primary/10 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/50">
            Active applications
          </p>
          <p className="mt-2 text-sm text-primary">
            Coach {detail.applicationCounts.coach} · Venue{" "}
            {detail.applicationCounts.venue}
          </p>
        </div>
        <div className="rounded-2xl border border-primary/10 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/50">
            Relationships
          </p>
          <p className="mt-2 text-sm text-primary">
            Via coaches {detail.relationshipCounts.coach} · Via venues{" "}
            {detail.relationshipCounts.venue}
          </p>
        </div>
        <div className="rounded-2xl border border-primary/10 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/50">
            Future player bookings
          </p>
          <p className="mt-2 text-2xl font-semibold text-primary">
            {detail.bookingCounts.futurePlayer}
          </p>
        </div>
        <div className="rounded-2xl border border-primary/10 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/50">
            Coach bookings pending
          </p>
          <p className="mt-2 text-2xl font-semibold text-primary">
            {detail.bookingCounts.coachPending}
          </p>
        </div>
      </div>
    </div>
  );
}
