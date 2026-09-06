"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import AccountAvatarManager from "@/components/account/AccountAvatarManager";
import { completeAdminWelcomeAction } from "@/app/admin/welcome/actions";

export default function AdminWelcomeClient({
  userId,
  email,
  fullName,
  avatarUrl,
}: {
  userId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(fullName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await completeAdminWelcomeAction(name);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.replace("/admin");
    });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
        Admin workspace
      </p>
      <h1 className="mt-3 text-3xl text-primary">
        Welcome to Padel Pathways
      </h1>
      <p className="mt-3 text-base leading-7 text-primary/65">
        Complete your account before continuing.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-6">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-primary/50">
            Full name
          </span>
          <input
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-xl border border-primary/15 px-3 py-2.5 text-sm outline-none focus:border-primary/40"
            placeholder="Your full name"
            autoComplete="name"
          />
        </label>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary/50">
            Account photo (optional)
          </p>
          <AccountAvatarManager
            userId={userId}
            fullName={name || fullName}
            email={email}
            avatarUrl={avatarUrl}
          />
        </div>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent disabled:opacity-50"
        >
          {pending ? "Saving…" : "Continue to Admin workspace"}
        </button>
      </form>
    </div>
  );
}
