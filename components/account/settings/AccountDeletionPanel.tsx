"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelAccountDeletionAction,
  requestAccountDeletionAction,
} from "@/app/account/settings/deletion-actions";
import {
  ACCOUNT_DELETION_STATUS_LABELS,
  DELETION_CONFIRMATION_TEXT,
  DELETION_REASON_MAX_LENGTH,
  isActiveOpenDeletionStatus,
  type AccountDeletionRequest,
  type DeletionResponsibilitySummary,
} from "@/lib/accountDeletion/types";

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

export default function AccountDeletionPanel({
  request,
  responsibility,
}: {
  request: AccountDeletionRequest | null;
  responsibility: DeletionResponsibilitySummary;
}) {
  const router = useRouter();
  const cancelDialogRef = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [cancelError, setCancelError] = useState<string | null>(null);

  const openRequest =
    request && isActiveOpenDeletionStatus(request.status) ? request : null;
  const showForm =
    !openRequest &&
    (!request ||
      request.status === "cancelled" ||
      request.status === "declined");

  function submitRequest() {
    setError(null);
    setMessage(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await requestAccountDeletionAction({
        reason,
        confirmation,
      });
      if (!result.ok) {
        setError(result.message);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      setMessage(result.message);
      setReason("");
      setConfirmation("");
      router.refresh();
    });
  }

  function confirmCancel() {
    if (!openRequest) return;
    setCancelError(null);
    startTransition(async () => {
      const result = await cancelAccountDeletionAction({
        requestId: openRequest.id,
      });
      if (!result.ok) {
        setCancelError(result.message);
        return;
      }
      cancelDialogRef.current?.close();
      setMessage(result.message);
      router.refresh();
    });
  }

  return (
    <section
      id="delete"
      aria-labelledby="delete-heading"
      className="scroll-mt-24 rounded-[20px] border border-red-200 bg-red-50/40 p-5 sm:p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-800/70">
        Danger zone
      </p>
      <h2 id="delete-heading" className="mt-2 text-xl font-bold text-primary">
        Delete account
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-primary/70">
        Deleting your account may affect coach profiles, venues, relationships
        and booking history connected to your account. Our team will review the
        request before the account is removed.
      </p>

      <ul className="mt-5 grid gap-2 text-sm text-primary/75 sm:grid-cols-2">
        <li>
          Coach profiles managed:{" "}
          <span className="font-semibold text-primary">
            {responsibility.coachCount}
          </span>
        </li>
        <li>
          Venues managed:{" "}
          <span className="font-semibold text-primary">
            {responsibility.venueCount}
          </span>
        </li>
        <li>
          Active future bookings as requester:{" "}
          <span className="font-semibold text-primary">
            {responsibility.futurePlayerBookings}
          </span>
        </li>
        <li>
          Coach bookings awaiting action:{" "}
          <span className="font-semibold text-primary">
            {responsibility.coachPendingBookings}
          </span>
        </li>
        <li className="sm:col-span-2">
          Active venue responsibilities:{" "}
          <span className="font-semibold text-primary">
            {responsibility.venueCount}
          </span>
        </li>
      </ul>

      {message ? (
        <p
          className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
          role="status"
        >
          {message}
        </p>
      ) : null}

      {request && !showForm ? (
        <div className="mt-5 rounded-2xl border border-primary/10 bg-white p-4">
          <p className="text-sm font-semibold text-primary">
            {ACCOUNT_DELETION_STATUS_LABELS[request.status]}
          </p>
          <p className="mt-1 text-sm text-primary/60">
            Requested {formatDate(request.requested_at)}
          </p>
          {request.status === "requested" ? (
            <p className="mt-2 text-sm text-primary/65">
              Our team will review your account responsibilities before any
              permanent deletion.
            </p>
          ) : null}
          {request.status === "processing" ? (
            <p className="mt-2 text-sm text-primary/65">
              Your request is in progress and can no longer be cancelled from
              settings.
            </p>
          ) : null}
          {request.status === "declined" ? (
            <p className="mt-2 text-sm text-primary/65">
              We could not complete this request. Please contact support if you
              still need help.
            </p>
          ) : null}
          {request.status === "completed" ? (
            <p className="mt-2 text-sm text-primary/65">
              Account deletion completed.
            </p>
          ) : null}

          {openRequest?.status === "requested" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setCancelError(null);
                cancelDialogRef.current?.showModal();
              }}
              className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl border border-primary/15 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-surface disabled:opacity-50"
            >
              Cancel deletion request
            </button>
          ) : null}
        </div>
      ) : null}

      {showForm ? (
        <div className="mt-5 space-y-4 rounded-2xl border border-primary/10 bg-white p-4">
          {request?.status === "cancelled" || request?.status === "declined" ? (
            <p className="text-sm text-primary/65">
              {request.status === "cancelled"
                ? "Your previous deletion request was cancelled. You can submit a new request below."
                : "Your previous deletion request could not be completed. You can submit a new request below."}
            </p>
          ) : null}

          <label className="block text-sm font-semibold text-primary">
            Reason (optional)
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={DELETION_REASON_MAX_LENGTH}
              rows={3}
              className="mt-1.5 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2 text-sm font-normal text-primary"
              placeholder="Tell us why you are leaving (optional)"
            />
            {fieldErrors.reason ? (
              <span className="mt-1 block text-xs font-medium text-red-700">
                {fieldErrors.reason}
              </span>
            ) : null}
          </label>

          <label className="block text-sm font-semibold text-primary">
            Type {DELETION_CONFIRMATION_TEXT} to confirm
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              className="mt-1.5 w-full rounded-xl border border-primary/15 bg-surface px-3 py-2 text-sm font-normal text-primary"
              placeholder={DELETION_CONFIRMATION_TEXT}
            />
            {fieldErrors.confirmation ? (
              <span className="mt-1 block text-xs font-medium text-red-700">
                {fieldErrors.confirmation}
              </span>
            ) : null}
          </label>

          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            disabled={pending}
            onClick={submitRequest}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-red-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
          >
            {pending ? "Submitting…" : "Request account deletion"}
          </button>
        </div>
      ) : null}

      <dialog
        ref={cancelDialogRef}
        className="fixed left-1/2 top-1/2 z-50 w-[min(100%,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-primary/10 bg-white p-0 shadow-[0_20px_60px_rgba(3,19,34,0.18)] backdrop:bg-primary/40"
        aria-labelledby="cancel-deletion-title"
      >
        <div className="p-6">
          <h3
            id="cancel-deletion-title"
            className="text-xl font-bold text-primary"
          >
            Cancel deletion request?
          </h3>
          <p className="mt-3 text-sm leading-6 text-primary/70">
            Your account will remain active and you can request deletion again
            later if needed.
          </p>
          {cancelError ? (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {cancelError}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() => cancelDialogRef.current?.close()}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-primary/15 px-4 py-2.5 text-sm font-semibold text-primary disabled:opacity-50"
            >
              Keep request
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={confirmCancel}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-accent disabled:opacity-50"
            >
              {pending ? "Cancelling…" : "Cancel request"}
            </button>
          </div>
        </div>
      </dialog>
    </section>
  );
}
