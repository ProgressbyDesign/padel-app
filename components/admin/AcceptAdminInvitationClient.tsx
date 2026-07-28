"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import {
  acceptAdminInvitationAction,
  sendAdminInvitationMagicLink,
  storeInvitationTokenFromLegacyUrlAction,
  switchAdminInvitationAccountAction,
  type InvitationPreview,
} from "@/app/admin/invitations/actions";

export type AcceptInvitationUiState =
  | "legacy-token"
  | "signed-out"
  | "check-email"
  | "pending"
  | "unavailable"
  | "expired"
  | "cancelled"
  | "accepted"
  | "missing-cookie"
  | "invalid-token";

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
  signedInEmail,
  preview,
  legacyToken,
}: {
  state: AcceptInvitationUiState;
  signedInEmail: string | null;
  preview?: InvitationPreview | null;
  /** Present only for legacy accept?token= Continue flow — never used after Continue. */
  legacyToken?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [checkEmail, setCheckEmail] = useState(state === "check-email");

  const roleLabel = preview?.roleLabel ?? "Admin";
  const expiryLabel = formatExpiry(preview?.expiresAt);

  function onAccept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptAdminInvitationAction();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.replace("/admin");
    });
  }

  function onMagicLink(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await sendAdminInvitationMagicLink(email);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCheckEmail(true);
    });
  }

  if (state === "legacy-token" && legacyToken) {
    return (
      <Shell title="Continue your invitation">
        <p className="mt-6 text-base leading-7 text-primary/65">
          For security, we&apos;ll continue without keeping the invitation token
          in your browser address bar.
        </p>
        <form action={storeInvitationTokenFromLegacyUrlAction} className="mt-6">
          <input type="hidden" name="token" value={legacyToken} />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent"
          >
            Continue
          </button>
        </form>
      </Shell>
    );
  }

  if (state === "signed-out" || checkEmail) {
    return (
      <Shell title="Join the Padel Pathways admin team">
        {checkEmail ? (
          <div className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold text-primary">
              Check your email
            </h2>
            <p className="text-base leading-7 text-primary/65">
              We sent a secure sign-in link. Open it to continue your Admin
              invitation.
            </p>
            {error ? <ErrorBox message={error} /> : null}
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setCheckEmail(false);
                setError(null);
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/15 px-5 py-2.5 text-sm font-semibold text-primary disabled:opacity-50"
            >
              Send another link
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <p className="text-base leading-7 text-primary/65">
              You need a Padel Pathways account before accepting this
              invitation.
            </p>
            <form onSubmit={onMagicLink} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-primary/50">
                  Email address
                </span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-primary/15 px-3 py-2.5 text-sm outline-none focus:border-primary/40"
                  placeholder="you@example.com"
                />
              </label>
              <p className="text-sm leading-6 text-primary/55">
                We&apos;ll send a secure sign-in link. If you&apos;re new to
                Padel Pathways, your account will be created when you confirm
                your email.
              </p>
              {error ? <ErrorBox message={error} /> : null}
              <button
                type="submit"
                disabled={pending}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent disabled:opacity-50 sm:w-auto"
              >
                {pending ? "Sending…" : "Continue securely by email"}
              </button>
            </form>
            <p className="text-sm text-primary/55">
              Prefer a password?{" "}
              <Link
                href="/login?next=%2Fadmin%2Finvitations%2Faccept"
                className="font-semibold text-primary underline"
              >
                Use password instead
              </Link>
            </p>
          </div>
        )}
      </Shell>
    );
  }

  if (state === "pending") {
    return (
      <Shell title="Join the Padel Pathways admin team">
        <div className="mt-6 space-y-4">
          <dl className="space-y-3 rounded-2xl border border-primary/10 bg-white p-4">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-primary/45">
                Invited role
              </dt>
              <dd className="mt-1 text-base font-semibold text-primary">
                {roleLabel}
              </dd>
              {preview?.roleDescription ? (
                <p className="mt-1 text-sm leading-6 text-primary/60">
                  {preview.roleDescription}
                </p>
              ) : null}
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-primary/45">
                Account
              </dt>
              <dd className="mt-1 text-base font-semibold text-primary">
                {signedInEmail || "Signed-in account"}
              </dd>
            </div>
            {expiryLabel ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-primary/45">
                  Expires
                </dt>
                <dd className="mt-1 text-sm text-primary/70">{expiryLabel}</dd>
              </div>
            ) : null}
          </dl>
          <p className="text-sm leading-6 text-primary/60">
            Your Admin access will begin only after you accept this invitation.
          </p>
          {error ? <ErrorBox message={error} /> : null}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={onAccept}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent disabled:opacity-50"
            >
              {pending ? "Accepting…" : "Accept invitation"}
            </button>
            <form action={switchAdminInvitationAccountAction}>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/15 px-5 py-2.5 text-sm font-semibold text-primary"
              >
                Switch account
              </button>
            </form>
          </div>
        </div>
      </Shell>
    );
  }

  if (state === "expired") {
    return (
      <Shell title="Invitation expired">
        <p className="mt-6 text-base leading-7 text-primary/65">
          This invitation has expired. Ask an Owner to send a new invitation.
        </p>
        <HomeLink />
      </Shell>
    );
  }

  if (state === "cancelled") {
    return (
      <Shell title="Invitation cancelled">
        <p className="mt-6 text-base leading-7 text-primary/65">
          This invitation is no longer active.
        </p>
        <HomeLink />
      </Shell>
    );
  }

  if (state === "accepted") {
    return (
      <Shell title="Invitation already accepted">
        <p className="mt-6 text-base leading-7 text-primary/65">
          This invitation has already been accepted.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {preview?.hasActiveMembership ? (
            <Link
              href="/admin"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent"
            >
              Open Admin workspace
            </Link>
          ) : (
            <p className="text-sm text-primary/60">
              Contact an Owner if you need access restored.
            </p>
          )}
        </div>
        <HomeLink />
      </Shell>
    );
  }

  if (state === "unavailable") {
    return (
      <Shell title="This invitation cannot be used with the current account">
        <p className="mt-6 text-base leading-7 text-primary/65">
          Possible reasons include signing in with a different email, an invalid
          link, or an invitation that was replaced by a resend.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <form action={switchAdminInvitationAccountAction}>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent"
            >
              Switch account
            </button>
          </form>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/15 px-5 py-2.5 text-sm font-semibold text-primary"
          >
            Return home
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Invitation unavailable">
      <p className="mt-6 text-base leading-7 text-primary/65">
        This invitation link is invalid or incomplete. Open the latest
        invitation email, or ask an Owner for a new invitation.
      </p>
      <HomeLink />
    </Shell>
  );
}

function Shell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
        Admin invitation
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-primary">
        {title}
      </h1>
      {children}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
      {message}
    </p>
  );
}

function HomeLink() {
  return (
    <div className="mt-8">
      <Link
        href="/"
        className="text-sm font-semibold text-primary/60 hover:text-primary"
      >
        Return home
      </Link>
    </div>
  );
}
