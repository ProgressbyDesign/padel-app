"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import PadelPathwaysLogo from "@/components/brand/PadelPathwaysLogo";

const nav = [
  { href: "/", label: "Home" },
  { href: "/venues", label: "Venues" },
  { href: "/coaches", label: "Coaches" },
  { href: "/contact", label: "Contact" },
] as const;

const SCROLL_SOLID_AFTER = 72;

export default function AppHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [solid, setSolid] = useState(!isHome);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!isHome) {
      setSolid(true);
      return;
    }
    setSolid(window.scrollY > SCROLL_SOLID_AFTER);
    const onScroll = () => setSolid(window.scrollY > SCROLL_SOLID_AFTER);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const overlay = isHome && !solid && !menuOpen;
  const headerPosition = isHome ? "fixed top-0 left-0 right-0" : "sticky top-0";

  const headerSurface = overlay
    ? "border-b border-transparent bg-transparent"
    : "border-b border-primary/10 bg-white/95 backdrop-blur-md shadow-sm";

  const linkIdle = overlay
    ? "text-white/85 hover:bg-white/10 hover:text-white"
    : "text-primary/70 hover:bg-surface hover:text-primary";

  const linkActive = overlay ? "bg-white/15 text-white" : "bg-primary/10 text-primary";

  return (
    <header className={`${headerPosition} z-50 transition-colors duration-300 ${headerSurface}`}>
      <div className="mx-auto flex h-16 max-w-[1680px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-[120px]">
        <PadelPathwaysLogo variant={overlay ? "white" : "black"} />

        <nav className="hidden items-center justify-end gap-1 md:flex md:gap-2" aria-label="Main">
          {nav.map((item) => {
            const active = isNavActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-2 text-sm font-medium transition sm:px-4 ${
                  active ? linkActive : linkIdle
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/join"
            className={`rounded-full px-4 py-2 text-sm font-semibold transition sm:px-5 ${
              overlay
                ? "bg-white text-primary shadow-md hover:bg-white/95"
                : "bg-primary text-accent shadow-sm hover:bg-primary/90"
            }`}
          >
            Join PadelPathways
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          className={`flex h-10 w-10 items-center justify-center rounded-full transition md:hidden ${
            overlay ? "text-white hover:bg-white/10" : "text-primary hover:bg-surface"
          }`}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {menuOpen ? (
        <div className="border-t border-primary/10 bg-white shadow-lg md:hidden">
          <nav
            className="mx-auto flex max-w-[1680px] flex-col gap-1 px-4 py-3 sm:px-6 lg:px-[120px]"
            aria-label="Mobile"
          >
            {nav.map((item) => {
              const active = isNavActive(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`rounded-xl px-4 py-3 text-base font-medium transition ${
                    active ? "bg-primary/10 text-primary" : "text-primary/75 hover:bg-surface"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link
              href="/join"
              onClick={() => setMenuOpen(false)}
              className="mt-1 rounded-xl bg-primary px-4 py-3 text-center text-base font-semibold text-accent shadow-sm transition hover:bg-primary/90"
            >
              Join PadelPathways
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

function isNavActive(href: string, pathname: string) {
  return (
    pathname === href ||
    (href === "/venues" && (pathname === "/venues" || pathname.startsWith("/venue/"))) ||
    (href === "/coaches" && (pathname === "/coaches" || pathname.startsWith("/coach/"))) ||
    (href === "/contact" && pathname.startsWith("/contact"))
  );
}
