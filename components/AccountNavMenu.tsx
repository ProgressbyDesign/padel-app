"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { logoutAction } from "@/app/actions/auth";
import { setWorkspacePreference } from "@/app/account/workspace/actions";
import AccountAvatar from "@/components/account/AccountAvatar";
import type { AccountNavContext } from "@/lib/workspace/resolve";
import { ROLE_LABELS } from "@/lib/admin/permissions";

export default function AccountNavMenu({
  account,
  overlay,
  onNavigate,
  variant = "desktop",
}: {
  account: AccountNavContext;
  overlay?: boolean;
  onNavigate?: () => void;
  variant?: "desktop" | "mobile";
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const triggerId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  function close() {
    setOpen(false);
    onNavigate?.();
  }

  function prefer(
    type: "personal" | "coach" | "venue" | "admin",
    entityId?: string | null
  ) {
    startTransition(async () => {
      await setWorkspacePreference({ type, entityId });
    });
  }

  const itemClass =
    "block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-primary/80 transition hover:bg-surface hover:text-primary disabled:opacity-60";

  const menu = (
    <div
      id={menuId}
      role="menu"
      aria-labelledby={triggerId}
      className={
        variant === "desktop"
          ? "absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-primary/10 bg-white p-2 shadow-[0_12px_40px_rgba(3,19,34,0.12)]"
          : "mt-2 space-y-1 rounded-2xl border border-primary/10 bg-surface/40 p-2"
      }
    >
      <p className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary/40">
        Personal
      </p>
      <button
        type="button"
        role="menuitem"
        disabled={pending}
        className={itemClass}
        onClick={() => prefer("personal")}
      >
        Personal dashboard
      </button>
      <Link
        href="/account/bookings"
        role="menuitem"
        className={itemClass}
        onClick={close}
      >
        Session requests
      </Link>
      <Link
        href="/account/applications"
        role="menuitem"
        className={itemClass}
        onClick={close}
      >
        Applications
      </Link>
      <Link
        href="/account/settings"
        role="menuitem"
        className={itemClass}
        onClick={close}
      >
        Account settings
      </Link>

      {account.coaches.length > 0 ? (
        <>
          <p className="mt-2 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary/40">
            Coach profiles
          </p>
          {account.coaches.map((coach) => (
            <button
              key={coach.id}
              type="button"
              role="menuitem"
              disabled={pending}
              className={itemClass}
              onClick={() => prefer("coach", coach.id)}
            >
              {coach.name}
            </button>
          ))}
        </>
      ) : null}

      {account.venues.length > 0 ? (
        <>
          <p className="mt-2 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary/40">
            Venues
          </p>
          {account.venues.map((venue) => (
            <button
              key={venue.id}
              type="button"
              role="menuitem"
              disabled={pending}
              className={itemClass}
              onClick={() => prefer("venue", venue.id)}
            >
              {venue.name}
            </button>
          ))}
        </>
      ) : null}

      {account.isAdmin ? (
        <>
          <p className="mt-2 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary/40">
            Admin
          </p>
          <button
            type="button"
            role="menuitem"
            disabled={pending}
            className={itemClass}
            onClick={() => prefer("admin")}
          >
            <span className="block">Admin workspace</span>
            {account.adminRole ? (
              <span className="block text-xs font-normal text-primary/45">
                {ROLE_LABELS[account.adminRole]}
              </span>
            ) : null}
          </button>
        </>
      ) : null}

      <div className="my-2 border-t border-primary/10" />
      <Link href="/join" role="menuitem" className={itemClass} onClick={close}>
        Add or claim a profile
      </Link>
      <form action={logoutAction}>
        <button
          type="submit"
          role="menuitem"
          disabled={pending}
          className={itemClass}
        >
          Log out
        </button>
      </form>
    </div>
  );

  if (variant === "mobile") {
    return (
      <div ref={rootRef}>
        <button
          type="button"
          id={triggerId}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-base font-medium text-primary/75 transition hover:bg-surface"
        >
          <AccountAvatar
            url={account.avatarUrl}
            name={account.fullName}
            email={account.email}
            size="sm"
          />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-primary">
              {account.fullName || "My account"}
            </span>
            <span className="block truncate text-sm text-primary/55">
              {account.email}
            </span>
          </span>
        </button>
        {open ? menu : null}
      </div>
    );
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        id={triggerId}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Account menu"
        onClick={() => setOpen((value) => !value)}
        className={`overflow-hidden rounded-full transition ${
          overlay
            ? "ring-2 ring-white/25 hover:ring-white/40"
            : "hover:opacity-90"
        }`}
      >
        <AccountAvatar
          url={account.avatarUrl}
          name={account.fullName}
          email={account.email}
          size="sm"
          tone={overlay && !account.avatarUrl ? "overlay" : "default"}
        />
      </button>
      {open ? menu : null}
    </div>
  );
}
