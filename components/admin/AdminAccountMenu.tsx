"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import AccountAvatar from "@/components/account/AccountAvatar";
import type { AdminAccount } from "@/lib/auth/adminSession";
import { ROLE_LABELS } from "@/lib/admin/permissions";

export default function AdminAccountMenu({ account }: { account: AdminAccount }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const triggerId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  const displayName = account.fullName || account.email || "Account";
  const roleLabel = ROLE_LABELS[account.role];

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="flex min-w-0 items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-surface"
      >
        <AccountAvatar
          name={displayName}
          url={account.avatarUrl}
          email={account.email}
          size="sm"
        />
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-sm font-semibold text-primary">
            {displayName}
          </span>
          <span className="block truncate text-xs text-primary/50">
            {roleLabel}
          </span>
        </span>
        <ChevronDown
          className={`hidden h-4 w-4 shrink-0 text-primary/40 sm:block ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-primary/10 bg-white p-2 shadow-lg"
        >
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary/40">
            Account
          </p>
          <Link
            href="/account/settings?from=admin"
            role="menuitem"
            className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-primary hover:bg-surface"
            onClick={() => setOpen(false)}
          >
            Account settings
          </Link>
          <Link
            href="/account"
            role="menuitem"
            className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-primary hover:bg-surface"
            onClick={() => setOpen(false)}
          >
            Switch workspace
          </Link>
          <div className="my-2 border-t border-primary/10" />
          <form action={logoutAction}>
            <button
              type="submit"
              role="menuitem"
              className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-primary hover:bg-surface"
            >
              Log out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
