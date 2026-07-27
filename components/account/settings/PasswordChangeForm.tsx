"use client";

import { useId, useState, useTransition } from "react";
import { changeAccountPasswordAction } from "@/app/account/settings/actions";
import FormMessage from "@/components/auth/FormMessage";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-primary/15 bg-white px-3.5 py-3 text-base text-primary outline-none transition placeholder:text-primary/35 focus:border-primary/35 focus:ring-2 focus:ring-primary/10";

export default function PasswordChangeForm() {
  const formId = useId();
  const [pending, startTransition] = useTransition();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function clearFields() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await changeAccountPasswordAction({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccess(result.message);
      clearFields();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {error ? <FormMessage status="error">{error}</FormMessage> : null}
      {success ? <FormMessage status="success">{success}</FormMessage> : null}

      <label
        className="block text-sm font-medium text-primary"
        htmlFor={`${formId}-current`}
      >
        Current password
        <input
          id={`${formId}-current`}
          className={inputClass}
          type="password"
          name="currentPassword"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
          aria-invalid={Boolean(error)}
          disabled={pending}
        />
      </label>

      <label
        className="block text-sm font-medium text-primary"
        htmlFor={`${formId}-new`}
      >
        New password
        <input
          id={`${formId}-new`}
          className={inputClass}
          type="password"
          name="newPassword"
          autoComplete="new-password"
          minLength={8}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
          aria-invalid={Boolean(error)}
          disabled={pending}
        />
        <span className="mt-1.5 block text-xs text-primary/50">
          Use at least 8 characters.
        </span>
      </label>

      <label
        className="block text-sm font-medium text-primary"
        htmlFor={`${formId}-confirm`}
      >
        Confirm new password
        <input
          id={`${formId}-confirm`}
          className={inputClass}
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          minLength={8}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
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
        {pending ? "Updating password…" : "Update password"}
      </button>
    </form>
  );
}
