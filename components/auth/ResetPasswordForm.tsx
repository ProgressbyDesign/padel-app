"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "@/app/actions/auth";
import {
  INITIAL_AUTH_ACTION_STATE,
  type AuthActionState,
} from "@/lib/auth/types";
import AuthSubmitButton from "./AuthSubmitButton";
import FormMessage from "./FormMessage";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-primary/15 bg-white px-3.5 py-3 text-base text-primary outline-none transition placeholder:text-primary/35 focus:border-primary/35 focus:ring-2 focus:ring-primary/10";

export default function ResetPasswordForm() {
  const [state, formAction] = useActionState<AuthActionState, FormData>(
    resetPasswordAction,
    INITIAL_AUTH_ACTION_STATE
  );

  return (
    <form action={formAction} className="space-y-5">
      {state.message ? <FormMessage status="error">{state.message}</FormMessage> : null}

      <label className="block text-sm font-medium text-primary">
        New password
        <input
          className={inputClass}
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <span className="mt-1.5 block text-xs text-primary/50">
          Use at least 8 characters.
        </span>
      </label>

      <label className="block text-sm font-medium text-primary">
        Confirm new password
        <input
          className={inputClass}
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>

      <AuthSubmitButton idleLabel="Update password" pendingLabel="Updating password…" />
    </form>
  );
}
