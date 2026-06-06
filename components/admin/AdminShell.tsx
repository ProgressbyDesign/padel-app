import Link from "next/link";
import { adminLogout } from "@/app/actions/admin";
import { adminAuthConfigured } from "@/lib/admin/auth";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/review-queue", label: "Review queue" },
  { href: "/admin/venues", label: "Venues" },
  { href: "/admin/coaches", label: "Coaches" },
  { href: "/admin/coach-venue-links", label: "Coach ↔ venue links" },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const configured = adminAuthConfigured();

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-primary/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <Link href="/admin" className="font-heading text-lg font-semibold text-primary">
              Padel Pathways Admin
            </Link>
            <p className="text-xs text-primary/50">
              Internal data review
              {!configured ? " · ADMIN_SECRET not set" : null}
            </p>
          </div>
          <form action={adminLogout}>
            <button
              type="submit"
              className="rounded border border-primary/15 px-3 py-1.5 text-sm text-primary hover:bg-surface"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside className="hidden w-48 shrink-0 md:block">
          <nav className="space-y-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded px-3 py-2 text-sm text-primary/80 hover:bg-white hover:text-primary"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <p className="mt-6 rounded border border-amber-200 bg-amber-50 px-2 py-2 text-[10px] leading-snug text-amber-900">
            TODO: Replace shared-secret auth with Supabase Auth admin role.
          </p>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      <nav className="fixed bottom-0 left-0 right-0 flex gap-1 border-t border-primary/10 bg-white p-2 md:hidden">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 rounded px-1 py-2 text-center text-[10px] text-primary/80"
          >
            {item.label.split(" ")[0]}
          </Link>
        ))}
      </nav>
      <div className="h-14 md:hidden" />
    </div>
  );
}
