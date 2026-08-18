"use client";

import Link from "next/link";
import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAccountDisplayNameAction } from "@/app/account/settings/actions";
import AccountAvatarManager from "@/components/account/AccountAvatarManager";
import AccountDeletionPanel from "@/components/account/settings/AccountDeletionPanel";
import EmailChangeForm from "@/components/account/settings/EmailChangeForm";
import PasswordChangeForm from "@/components/account/settings/PasswordChangeForm";
import SessionManagementPanel from "@/components/account/settings/SessionManagementPanel";
import type { AccountSettingsPageData } from "@/lib/queries/accountSettings";

const SECTIONS = [
  { id: "personal", label: "Personal details" },
  { id: "photo", label: "Profile image" },
  { id: "email", label: "Email" },
  { id: "password", label: "Password" },
  { id: "sessions", label: "Sessions" },
  { id: "profiles", label: "Managed profiles" },
  { id: "delete", label: "Delete account" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const inputClass =
  "mt-1.5 w-full rounded-xl border border-primary/15 bg-white px-3.5 py-3 text-base text-primary outline-none transition placeholder:text-primary/35 focus:border-primary/35 focus:ring-2 focus:ring-primary/10";

function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: SectionId;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="scroll-mt-24 rounded-[20px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-6"
    >
      <h2 id={`${id}-heading`} className="text-lg font-bold text-primary">
        {title}
      </h2>
      <p className="mt-1 text-sm leading-6 text-primary/60">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function DisplayNameForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(initialName);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const statusId = useId();

  useEffect(() => {
    setValue(initialName);
  }, [initialName]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await updateAccountDisplayNameAction(value);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4">
      <label className="block text-sm font-medium text-primary">
        Display name
        <input
          className={inputClass}
          name="fullName"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          minLength={2}
          maxLength={120}
          required
          disabled={pending}
          aria-describedby={statusId}
        />
      </label>
      <div id={statusId} aria-live="polite" className="space-y-2">
        {message ? (
          <p className="text-sm text-emerald-700">{message}</p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-primary/90 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save name"}
      </button>
    </form>
  );
}

function roleLabel(role: string): string {
  return role === "owner" ? "Owner" : role === "manager" ? "Manager" : role;
}

export default function AccountSettingsClient({
  data,
}: {
  data: AccountSettingsPageData;
}) {
  const [active, setActive] = useState<SectionId>("personal");

  useEffect(() => {
    function onScroll() {
      let current: SectionId = "personal";
      for (const section of SECTIONS) {
        const el = document.getElementById(section.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= 140) {
          current = section.id;
        }
      }
      setActive(current);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="mt-8 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
      <nav
        aria-label="Settings sections"
        className="mb-6 flex gap-2 overflow-x-auto pb-1 lg:mb-0 lg:sticky lg:top-24 lg:flex-col lg:overflow-visible lg:self-start"
      >
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className={`shrink-0 rounded-xl px-3 py-2 text-sm font-medium transition ${
              active === section.id
                ? "bg-primary text-accent"
                : "bg-surface text-primary/70 hover:bg-primary/10 hover:text-primary"
            }`}
          >
            {section.label}
          </a>
        ))}
      </nav>

      <div className="space-y-5">
        <SettingsSection
          id="personal"
          title="Personal details"
          description="Your display name appears in the account menu and personal workspace."
        >
          <DisplayNameForm initialName={data.account.fullName ?? ""} />
        </SettingsSection>

        <SettingsSection
          id="photo"
          title="Profile image"
          description="Shown in the account menu across the site."
        >
          <AccountAvatarManager
            userId={data.account.id}
            fullName={data.account.fullName}
            email={data.account.email}
            avatarUrl={data.account.avatarUrl}
          />
        </SettingsSection>

        <SettingsSection
          id="email"
          title="Email"
          description="Change the email address used to sign in. Confirmation may be required."
        >
          <EmailChangeForm currentEmail={data.account.email} />
        </SettingsSection>

        <SettingsSection
          id="password"
          title="Password"
          description="Update your password. You will need your current password."
        >
          <PasswordChangeForm />
        </SettingsSection>

        <SettingsSection
          id="sessions"
          title="Sessions"
          description="Manage where you are signed in."
        >
          <SessionManagementPanel />
        </SettingsSection>

        <SettingsSection
          id="profiles"
          title="Managed profiles"
          description="Coach and venue workspaces linked to this account. Read-only here."
        >
          {data.coaches.length === 0 && data.venues.length === 0 ? (
            <p className="text-sm text-primary/60">
              No managed profiles yet.{" "}
              <Link
                href="/join"
                className="font-semibold text-primary underline-offset-2 hover:underline"
              >
                Join Padel Pathways
              </Link>
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.coaches.map((coach) => (
                <article
                  key={`coach-${coach.id}`}
                  className="rounded-2xl border border-primary/10 bg-surface/40 px-4 py-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/40">
                    Coach · {roleLabel(coach.membershipRole)}
                  </p>
                  <p className="mt-1 font-semibold text-primary">{coach.name}</p>
                  <Link
                    href={`/account/coaches/${encodeURIComponent(coach.id)}`}
                    className="mt-3 inline-flex text-sm font-semibold text-primary/70 transition hover:text-primary"
                  >
                    Open workspace
                  </Link>
                </article>
              ))}
              {data.venues.map((venue) => (
                <article
                  key={`venue-${venue.id}`}
                  className="rounded-2xl border border-primary/10 bg-surface/40 px-4 py-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/40">
                    Venue · {roleLabel(venue.membershipRole)}
                  </p>
                  <p className="mt-1 font-semibold text-primary">{venue.name}</p>
                  <Link
                    href={`/account/venues/${encodeURIComponent(venue.id)}`}
                    className="mt-3 inline-flex text-sm font-semibold text-primary/70 transition hover:text-primary"
                  >
                    Open workspace
                  </Link>
                </article>
              ))}
            </div>
          )}
        </SettingsSection>

        <AccountDeletionPanel
          request={data.deletionRequest}
          responsibility={data.responsibility}
        />
      </div>
    </div>
  );
}
