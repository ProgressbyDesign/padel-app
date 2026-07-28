"use client";

import {
  Building2,
  CalendarCheck2,
  ClipboardList,
  Database,
  LayoutDashboard,
  Link2,
  Menu,
  ScrollText,
  UserRound,
  UserRoundCheck,
  Users,
  UserX,
  X,
} from "lucide-react";
import AdminAccountMenu from "@/components/admin/AdminAccountMenu";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import type { AdminAccount } from "@/lib/auth/adminSession";
import {
  navItemsForMembership,
  ROLE_LABELS,
  type AdminNavItem,
} from "@/lib/admin/permissions";

const NAV_ICONS: Record<string, typeof LayoutDashboard> = {
  "/admin": LayoutDashboard,
  "/admin/applications/coaches": UserRoundCheck,
  "/admin/applications/venues": Building2,
  "/admin/relationships": Link2,
  "/admin/bookings": CalendarCheck2,
  "/admin/account-deletions": UserX,
  "/admin/team": Users,
  "/admin/audit": ScrollText,
  "/admin/data-quality": Database,
};

function navIsActive(pathname: string, item: AdminNavItem) {
  if (item.exact) return pathname === item.href;
  if (item.href === "/admin/applications/coaches") {
    return (
      pathname.startsWith(item.href) || pathname.startsWith("/admin/coaches/")
    );
  }
  if (item.href === "/admin/applications/venues") {
    return (
      pathname.startsWith(item.href) || pathname.startsWith("/admin/venues/")
    );
  }
  return pathname.startsWith(item.href);
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
  const roleLabel = ROLE_LABELS[account.role];

  const navItems = useMemo(
    () => navItemsForMembership(account),
    [account]
  );

  const nav = (
    <nav className="space-y-1" aria-label="Admin navigation">
      {navItems.map((item) => {
        const Icon = NAV_ICONS[item.href] ?? ClipboardList;
        const active = navIsActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              active
                ? "bg-primary text-accent"
                : "text-primary/65 hover:bg-primary/5 hover:text-primary"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {item.label}
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
            <div>
              <Link
                href="/admin"
                className="font-heading text-lg font-bold tracking-tight"
              >
                Padel Pathways{" "}
                <span className="text-primary/40">Admin</span>
              </Link>
              <p className="text-xs font-medium text-primary/45">
                Admin workspace · {roleLabel}
              </p>
            </div>
          </div>
          <AdminAccountMenu account={account} />
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
            Operational tools use your authenticated admin account and database
            policies.
          </p>
        </aside>
        <main className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
