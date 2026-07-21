"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction } from "@/app/actions/auth";
import {
  INITIAL_AUTH_ACTION_STATE,
  type AuthActionState,
} from "@/lib/auth/types";
import AuthSubmitButton from "./AuthSubmitButton";
import FormMessage from "./FormMessage";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-primary/15 bg-white px-3.5 py-3 text-base text-primary outline-none transition placeholder:text-primary/35 focus:border-primary/35 focus:ring-2 focus:ring-primary/10";

export default function ForgotPasswordForm() {
  const [state, formAction] = useActionState<AuthActionState, FormData>(
    forgotPasswordAction,
    INITIAL_AUTH_ACTION_STATE
  );

  return (
    <form action={formAction} className="space-y-5">
      {state.message ? (
        <FormMessage status={state.status === "success" ? "success" : "error"}>
          {state.message}
        </FormMessage>
      ) : null}

      <label className="block text-sm font-medium text-primary">
        Email address
        <input
          className={inputClass}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          required
        />
      </label>

      <AuthSubmitButton idleLabel="Send reset link" pendingLabel="Sending link…" />

      <p className="text-center text-sm text-primary/65">
        Remembered your password?{" "}
        <Link href="/login" className="font-semibold text-primary underline underline-offset-4">
          Back to login
        </Link>
      </p>
    </form>
  );
}
