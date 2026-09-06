import Link from "next/link";

const NAV = [
  { href: "/admin/data-quality", label: "Dashboard" },
  { href: "/admin/data-quality/review-queue", label: "Review queue" },
  { href: "/admin/data-quality/venues", label: "Venues" },
  { href: "/admin/data-quality/coaches", label: "Coaches" },
  { href: "/admin/data-quality/coach-venue-links", label: "Coach → venue links" },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface" data-ui-headings>
      <header className="border-b border-primary/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <Link href="/admin/data-quality" className="font-heading text-lg font-semibold text-primary">
              Data quality admin
            </Link>
            <p className="text-xs text-primary/50">
              Owner-only crawler / repair tools
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded border border-primary/15 px-3 py-1.5 text-sm text-primary hover:bg-surface"
          >
            Back to Admin
          </Link>
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
