"use client";

import { useId, useState, useTransition } from "react";
import { changeAccountEmailAction } from "@/app/account/settings/actions";
import FormMessage from "@/components/auth/FormMessage";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-primary/15 bg-white px-3.5 py-3 text-base text-primary outline-none transition placeholder:text-primary/35 focus:border-primary/35 focus:ring-2 focus:ring-primary/10";

export default function EmailChangeForm({
  currentEmail,
}: {
  currentEmail: string;
}) {
  const formId = useId();
  const [pending, startTransition] = useTransition();
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await changeAccountEmailAction({
        newEmail,
        confirmEmail,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccess(result.message);
      setNewEmail("");
      setConfirmEmail("");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div>
        <p className="text-sm font-medium text-primary">Current email</p>
        <p className="mt-1.5 text-base text-primary/75">
          {currentEmail || "Not available"}
        </p>
      </div>

      {error ? <FormMessage status="error">{error}</FormMessage> : null}
      {success ? <FormMessage status="success">{success}</FormMessage> : null}

      <label className="block text-sm font-medium text-primary" htmlFor={`${formId}-new`}>
        New email
        <input
          id={`${formId}-new`}
          className={inputClass}
          type="email"
          name="newEmail"
          autoComplete="email"
          inputMode="email"
          value={newEmail}
          onChange={(event) => setNewEmail(event.target.value)}
          required
          aria-invalid={Boolean(error)}
          disabled={pending}
        />
      </label>

      <label
        className="block text-sm font-medium text-primary"
        htmlFor={`${formId}-confirm`}
      >
        Confirm new email
        <input
          id={`${formId}-confirm`}
          className={inputClass}
          type="email"
          name="confirmEmail"
          autoComplete="email"
          inputMode="email"
          value={confirmEmail}
          onChange={(event) => setConfirmEmail(event.target.value)}
          required
          aria-invalid={Boolean(error)}
          disabled={pending}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90 disabled:cursor-wait disabled:opacity-65"
      >
        {pending ? "Sending confirmation…" : "Update email"}
      </button>
    </form>
  );
}
