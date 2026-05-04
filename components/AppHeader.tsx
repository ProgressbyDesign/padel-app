"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Home" },
  { href: "/venues", label: "Venues" },
  { href: "/coaches", label: "Coaches" },
  { href: "/join", label: "Join" },
  { href: "/contact", label: "Contact" },
] as const;

export default function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-primary/15 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight text-primary sm:text-xl">
          Padel
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
          {nav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href === "/venues" && (pathname === "/venues" || pathname.startsWith("/venue/"))) ||
              (item.href === "/coaches" && (pathname === "/coaches" || pathname.startsWith("/coach/"))) ||
              (item.href === "/join" && pathname.startsWith("/join"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-2 text-sm font-medium transition sm:px-4 ${
                  active ? "bg-primary/10 text-primary" : "text-primary/70 hover:bg-surface hover:text-primary"
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
