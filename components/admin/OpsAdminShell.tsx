"use client";

import {
  Building2,
  CalendarCheck2,
  Database,
  LayoutDashboard,
  Link2,
  Menu,
  UserRound,
  UserRoundCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { AdminAccount } from "@/lib/auth/adminSession";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  {
    href: "/admin/applications/coaches",
    label: "Coach applications",
    icon: UserRoundCheck,
    exact: false,
  },
  {
    href: "/admin/applications/venues",
    label: "Venue applications",
    icon: Building2,
    exact: false,
  },
  { href: "/admin/relationships", label: "Relationships", icon: Link2, exact: false },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarCheck2, exact: false },
  { href: "/admin/data-quality", label: "Data quality", icon: Database, exact: false },
] as const;

function navIsActive(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href;
  if (href === "/admin/applications/coaches") {
    return (
      pathname.startsWith(href) || pathname.startsWith("/admin/coaches/")
    );
  }
  if (href === "/admin/applications/venues") {
    return (
      pathname.startsWith(href) || pathname.startsWith("/admin/venues/")
    );
  }
  return pathname.startsWith(href);
}

export default function OpsAdminShell({
  account,
  children,
}: {
  account: AdminAccount;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const displayName = account.fullName || account.email || "Admin";

  const nav = (
    <nav className="space-y-1" aria-label="Admin navigation">
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = navIsActive(pathname, href, exact);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              active
                ? "bg-primary text-accent"
                : "text-primary/65 hover:bg-primary/5 hover:text-primary"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
      {(pathname.startsWith("/admin/coaches/") ||
        pathname.startsWith("/admin/venues/")) && (
        <p className="mt-4 flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-primary/40">
          <UserRound className="h-3.5 w-3.5" aria-hidden />
          Profile inspection
        </p>
      )}
    </nav>
  );

  return (
    <div className="min-h-screen bg-surface text-primary">
      <header className="sticky top-0 z-40 border-b border-primary/10 bg-white/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-primary/10 lg:hidden"
              aria-label={open ? "Close navigation" : "Open navigation"}
              aria-expanded={open}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link href="/admin" className="font-heading text-lg font-bold tracking-tight">
              Padel Pathways <span className="text-primary/40">Admin</span>
            </Link>
          </div>
          <Link
            href="/account"
            className="min-w-0 rounded-xl px-3 py-2 text-right transition hover:bg-surface"
          >
            <span className="block truncate text-sm font-semibold">{displayName}</span>
            <span className="block max-w-52 truncate text-xs text-primary/50">
              {account.email || "View account"}
            </span>
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1680px] lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside
          className={`border-r border-primary/10 bg-white p-4 lg:sticky lg:top-16 lg:block lg:h-[calc(100vh-4rem)] ${
            open ? "block" : "hidden"
          }`}
        >
          {nav}
          <p className="mt-8 border-t border-primary/10 pt-4 text-xs leading-5 text-primary/45">
            Operational tools use your authenticated admin account and database policies.
          </p>
        </aside>
        <main className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
