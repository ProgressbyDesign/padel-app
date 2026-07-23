"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction } from "@/app/actions/auth";
import {
  INITIAL_AUTH_ACTION_STATE,
  type AuthActionState,
} from "@/lib/auth/types";
import AuthSubmitButton from "./AuthSubmitButton";
import FormMessage from "./FormMessage";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-primary/15 bg-white px-3.5 py-3 text-base text-primary outline-none transition placeholder:text-primary/35 focus:border-primary/35 focus:ring-2 focus:ring-primary/10";

export default function SignupForm({ nextPath = "/account" }: { nextPath?: string }) {
  const [state, formAction] = useActionState<AuthActionState, FormData>(
    signupAction,
    INITIAL_AUTH_ACTION_STATE
  );

  const loginHref = `/login?next=${encodeURIComponent(nextPath)}`;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={nextPath} />

      {state.message ? (
        <FormMessage status={state.status === "success" ? "success" : "error"}>
          {state.message}
        </FormMessage>
      ) : null}

      <label className="block text-sm font-medium text-primary">
        Full name
        <input
          className={inputClass}
          type="text"
          name="fullName"
          autoComplete="name"
          minLength={2}
          required
        />
      </label>

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
          autoComplete="new-password"
          minLength={8}
          required
        />
        <span className="mt-1.5 block text-xs text-primary/50">
          Use at least 8 characters.
        </span>
      </label>

      <label className="block text-sm font-medium text-primary">
        Confirm password
        <input
          className={inputClass}
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>

      <AuthSubmitButton idleLabel="Create account" pendingLabel="Creating account…" />

      <p className="text-center text-sm text-primary/65">
        Already have an account?{" "}
        <Link href={loginHref} className="font-semibold text-primary underline underline-offset-4">
          Log in
        </Link>
      </p>
    </form>
  );
}
