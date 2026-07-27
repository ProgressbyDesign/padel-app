"use client";

import { useRef, useState, useTransition } from "react";
import {
  signOutEverywhereAction,
  signOutOtherSessionsAction,
} from "@/app/account/settings/actions";
import { logoutAction } from "@/app/actions/auth";
import FormMessage from "@/components/auth/FormMessage";

type ConfirmKind = "others" | "everywhere" | null;

export default function SessionManagementPanel() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const everywhereFormRef = useRef<HTMLFormElement>(null);
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function openConfirm(kind: Exclude<ConfirmKind, null>) {
    setError(null);
    setConfirmKind(kind);
    dialogRef.current?.showModal();
  }

  function closeConfirm() {
    dialogRef.current?.close();
    setConfirmKind(null);
  }

  function confirmAction() {
    if (!confirmKind) return;
    setError(null);

    if (confirmKind === "everywhere") {
      closeConfirm();
      everywhereFormRef.current?.requestSubmit();
      return;
    }

    startTransition(async () => {
      const result = await signOutOtherSessionsAction();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccess(result.message);
      closeConfirm();
    });
  }

  const dialogTitle =
    confirmKind === "everywhere"
      ? "Sign out everywhere?"
      : "Sign out other sessions?";
  const dialogDescription =
    confirmKind === "everywhere"
      ? "You will need to sign in again on every device."
      : "Other devices will be signed out. You will stay signed in on this device.";

  return (
    <div className="space-y-5">
      <form
        ref={everywhereFormRef}
        action={signOutEverywhereAction}
        className="hidden"
      />

      {error ? <FormMessage status="error">{error}</FormMessage> : null}
      {success ? <FormMessage status="success">{success}</FormMessage> : null}

      <div className="space-y-3">
        <div className="rounded-xl border border-primary/10 bg-surface/50 px-4 py-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div>
            <p className="font-semibold text-primary">This device</p>
            <p className="mt-1 text-sm text-primary/65">
              Sign out of your current session only.
            </p>
          </div>
          <form action={logoutAction} className="mt-3 sm:mt-0">
            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/15 bg-white px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-surface"
            >
              Log out
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-primary/10 bg-surface/50 px-4 py-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div>
            <p className="font-semibold text-primary">Other sessions</p>
            <p className="mt-1 text-sm text-primary/65">
              Sign out everywhere except this device.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openConfirm("others")}
            disabled={pending}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/15 bg-white px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-surface disabled:opacity-50 sm:mt-0"
          >
            Sign out other sessions
          </button>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div>
            <p className="font-semibold text-red-950">All devices</p>
            <p className="mt-1 text-sm text-red-900/75">
              Sign out of every session, including this one.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openConfirm("everywhere")}
            disabled={pending}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50 sm:mt-0"
          >
            Sign out everywhere
          </button>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        className="fixed left-1/2 top-1/2 z-50 w-[min(100%,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-primary/10 bg-white p-0 shadow-[0_20px_60px_rgba(3,19,34,0.18)] backdrop:bg-primary/40"
        aria-labelledby="session-confirm-title"
        aria-describedby="session-confirm-desc"
        onClose={() => setConfirmKind(null)}
      >
        <div className="p-6">
          <h2
            id="session-confirm-title"
            className="text-xl font-bold text-primary"
          >
            {dialogTitle}
          </h2>
          <p
            id="session-confirm-desc"
            className="mt-3 text-sm leading-6 text-primary/70"
          >
            {dialogDescription}
          </p>
          {confirmKind === "everywhere" ? (
            <p
              className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
              role="note"
            >
              You will need to sign in again on every device.
            </p>
          ) : null}
          {error && confirmKind ? (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={closeConfirm}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-primary/15 px-4 py-2.5 text-sm font-semibold text-primary disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={confirmAction}
              className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${
                confirmKind === "everywhere"
                  ? "bg-red-700 text-white hover:bg-red-800"
                  : "bg-primary text-accent hover:bg-primary/90"
              }`}
            >
              {pending
                ? "Working…"
                : confirmKind === "everywhere"
                  ? "Sign out everywhere"
                  : "Sign out other sessions"}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
