"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { withdrawVenueApplication } from "@/app/account/applications/venue/actions";

export default function WithdrawVenueApplicationButton({
  applicationId,
  className = "",
}: {
  applicationId: string;
  className?: string;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function openDialog() {
    setError(null);
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  function confirmWithdraw() {
    setError(null);
    startTransition(async () => {
      const result = await withdrawVenueApplication(applicationId);
      if (result.status === "error") {
        setError(result.message ?? "We could not withdraw the application.");
        return;
      }
      closeDialog();
      router.push("/account/applications/venue");
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className={
          className ||
          "inline-flex min-h-11 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-900 transition hover:bg-red-100"
        }
      >
        Withdraw application
      </button>

      <dialog
        ref={dialogRef}
        className="fixed left-1/2 top-1/2 z-50 w-[min(100%,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-primary/10 bg-white p-0 shadow-[0_20px_60px_rgba(3,19,34,0.18)] backdrop:bg-primary/40"
        aria-labelledby="withdraw-venue-app-title"
        aria-describedby="withdraw-venue-app-desc"
      >
        <div className="p-6">
          <h2
            id="withdraw-venue-app-title"
            className="text-xl font-bold text-primary"
          >
            Withdraw this application?
          </h2>
          <p
            id="withdraw-venue-app-desc"
            className="mt-3 text-sm leading-6 text-primary/70"
          >
            Your current venue application will be closed. This cannot be
            undone.
          </p>
          {error ? (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={closeDialog}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-primary/15 px-4 py-2.5 text-sm font-semibold text-primary disabled:opacity-50"
            >
              Keep application
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={confirmWithdraw}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Withdrawing…" : "Withdraw application"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
