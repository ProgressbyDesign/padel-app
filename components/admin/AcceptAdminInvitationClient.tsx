"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { logoutAction } from "@/app/actions/auth";
import { acceptAdminInvitationAction } from "@/app/admin/invitations/actions";
import { ROLE_LABELS, type AdminRole } from "@/lib/admin/permissions";
import { safeInternalPath } from "@/lib/auth/safePath";

export type AcceptInvitationUiState =
  | "signed-out"
  | "matching-email"
  | "wrong-email"
  | "expired"
  | "cancelled"
  | "already-accepted"
  | "invalid";

function formatExpiry(value?: string) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function AcceptAdminInvitationClient({
  state,
  token,
  signedIn,
  signedInEmail,
  role,
  emailMasked,
  expiresAt,
}: {
  state: AcceptInvitationUiState;
  token: string;
  signedIn: boolean;
  signedInEmail: string | null;
  role?: AdminRole;
  emailMasked?: string;
  expiresAt?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const roleLabel = role ? ROLE_LABELS[role] : "Admin";
  const expiryLabel = formatExpiry(expiresAt);
  const acceptNext = safeInternalPath(
    token
      ? `/admin/invitations/accept?token=${encodeURIComponent(token)}`
      : "/admin/invitations/accept",
    "/admin/invitations/accept"
  );
  const loginHref = `/login?next=${encodeURIComponent(acceptNext)}`;

  function onAccept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptAdminInvitationAction(token);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // Success redirects server-side; if it returns, refresh without token.
      router.replace("/admin");
    });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
        Admin invitation
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-primary">
        Join the admin workspace
      </h1>

      {state === "signed-out" ? (
        <div className="mt-6 space-y-4">
          <p className="text-base leading-7 text-primary/65">
            You&apos;ve been invited to join Padel Pathways as{" "}
            <span className="font-semibold text-primary">{roleLabel}</span>
            {emailMasked ? (
              <>
                {" "}
                for <span className="font-semibold text-primary">{emailMasked}</span>
              </>
            ) : null}
            .
            {expiryLabel ? ` This invitation expires ${expiryLabel}.` : null}
          </p>
          <p className="text-sm leading-6 text-primary/55">
            Sign in with the invited email address to continue.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href={loginHref}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent"
            >
              Sign in to accept
            </Link>
            <Link
              href={`/signup?next=${encodeURIComponent(acceptNext)}`}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/15 px-5 py-2.5 text-sm font-semibold text-primary"
            >
              Create account
            </Link>
          </div>
        </div>
      ) : null}

      {state === "matching-email" ? (
        <div className="mt-6 space-y-4">
          <p className="text-base leading-7 text-primary/65">
            You&apos;re signed in as{" "}
            <span className="font-semibold text-primary">
              {signedInEmail || "this account"}
            </span>
            . Accept to join as{" "}
            <span className="font-semibold text-primary">{roleLabel}</span>
            {expiryLabel ? ` (expires ${expiryLabel})` : null}.
          </p>
          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            disabled={pending || !token}
            onClick={onAccept}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent disabled:opacity-50"
          >
            {pending ? "Accepting…" : "Accept invitation"}
          </button>
        </div>
      ) : null}

      {state === "wrong-email" ? (
        <div className="mt-6 space-y-4">
          <p className="text-base leading-7 text-primary/65">
            This invitation was sent to{" "}
            <span className="font-semibold text-primary">
              {emailMasked || "another email"}
            </span>
            , but you&apos;re signed in as{" "}
            <span className="font-semibold text-primary">
              {signedInEmail || "a different account"}
            </span>
            . Sign out and use the invited account.
          </p>
          <form action={logoutAction}>
            <input type="hidden" name="next" value={acceptNext} />
            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent"
            >
              Sign out and switch account
            </button>
          </form>
        </div>
      ) : null}

      {state === "expired" ? (
        <p className="mt-6 text-base leading-7 text-primary/65">
          This invitation has expired
          {emailMasked ? (
            <>
              {" "}
              for <span className="font-semibold text-primary">{emailMasked}</span>
            </>
          ) : null}
          . Ask an owner to send a new one.
        </p>
      ) : null}

      {state === "cancelled" ? (
        <p className="mt-6 text-base leading-7 text-primary/65">
          This invitation was cancelled and can no longer be accepted.
        </p>
      ) : null}

      {state === "already-accepted" ? (
        <div className="mt-6 space-y-4">
          <p className="text-base leading-7 text-primary/65">
            This invitation has already been accepted.
          </p>
          {signedIn ? (
            <Link
              href="/admin"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent"
            >
              Go to Admin
            </Link>
          ) : null}
        </div>
      ) : null}

      {state === "invalid" ? (
        <p className="mt-6 text-base leading-7 text-primary/65">
          This invitation link is invalid or incomplete. Check the email for
          the full link, or ask an owner for a new invitation.
        </p>
      ) : null}

      {state !== "matching-email" && state !== "signed-out" ? (
        <div className="mt-8">
          <Link
            href={signedIn ? "/account" : "/"}
            className="text-sm font-semibold text-primary/60 hover:text-primary"
          >
            {signedIn ? "Back to account" : "Back to home"}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
