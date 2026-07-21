"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import {
  INITIAL_AUTH_ACTION_STATE,
  type AuthActionState,
} from "@/lib/auth/types";
import AuthSubmitButton from "./AuthSubmitButton";
import FormMessage from "./FormMessage";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-primary/15 bg-white px-3.5 py-3 text-base text-primary outline-none transition placeholder:text-primary/35 focus:border-primary/35 focus:ring-2 focus:ring-primary/10";

type LoginFormProps = {
  nextPath: string;
  initialError?: string | null;
};

export default function LoginForm({ nextPath, initialError }: LoginFormProps) {
  const [state, formAction] = useActionState<AuthActionState, FormData>(
    loginAction,
    INITIAL_AUTH_ACTION_STATE
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={nextPath} />

      {state.message ? (
        <FormMessage status={state.status === "success" ? "success" : "error"}>
          {state.message}
        </FormMessage>
      ) : initialError ? (
        <FormMessage status="error">{initialError}</FormMessage>
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

      <label className="block text-sm font-medium text-primary">
        Password
        <input
          className={inputClass}
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </label>

      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-sm font-semibold text-primary/70 underline-offset-4 hover:text-primary hover:underline"
        >
          Forgot password?
        </Link>
      </div>

      <AuthSubmitButton idleLabel="Log in" pendingLabel="Logging in…" />

      <p className="text-center text-sm text-primary/65">
        New to Padel Pathways?{" "}
        <Link href="/signup" className="font-semibold text-primary underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </form>
  );
}
