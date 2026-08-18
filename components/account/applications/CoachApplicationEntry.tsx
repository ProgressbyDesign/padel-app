"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCoachApplicationDraft } from "@/app/account/applications/coach/actions";
import { ErrorSummary } from "@/components/forms/FormField";

export default function CoachApplicationEntry() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function startDraft() {
    setError(null);
    startTransition(async () => {
      const result = await createCoachApplicationDraft({
        mode: "create_new",
        targetCoachId: null,
      });
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      router.push("/account/applications/coach");
      router.refresh();
    });
  }

  return (
    <section className="rounded-[24px] border border-primary/10 bg-white p-6 sm:p-7">
      <h2 className="text-xl font-bold text-primary">Start your application</h2>
      <p className="mt-2 text-sm leading-6 text-primary/65">
        Apply as a coach to create your profile on Padel Pathways. Progress saves
        to your account.
      </p>

      {error ? (
        <div className="mt-4">
          <ErrorSummary title={error} errors={{}} />
        </div>
      ) : null}

      <div className="mt-6">
        <button
          type="button"
          disabled={pending}
          onClick={startDraft}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "Starting…" : "Start application"}
        </button>
      </div>
    </section>
  );
}
