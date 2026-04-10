"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Home" },
  { href: "/venues", label: "Venues" },
  { href: "/contact", label: "Contact" },
] as const;

export default function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
          Padel
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
          {nav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href === "/venues" && (pathname === "/venues" || pathname.startsWith("/venue/")));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-2 text-sm font-medium transition sm:px-4 ${
                  active ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
