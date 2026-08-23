"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import AccountNavMenu from "@/components/AccountNavMenu";
import PadelPathwaysLogo from "@/components/brand/PadelPathwaysLogo";
import type { AccountNavContext } from "@/lib/workspace/resolve";

const nav = [
  { href: "/", label: "Home" },
  { href: "/venues", label: "Venues" },
  { href: "/coaches", label: "Coaches" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact" },
] as const;

const SCROLL_SOLID_AFTER = 72;

export default function AppHeader({
  accountNav,
}: {
  accountNav: AccountNavContext | null;
}) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [homeScrolled, setHomeScrolled] = useState(false);
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const menuOpen = menuPath === pathname;
  const solid = !isHome || homeScrolled;

  useEffect(() => {
    if (!isHome) return;
    const onScroll = () =>
      setHomeScrolled(window.scrollY > SCROLL_SOLID_AFTER);
    const frame = window.requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [isHome]);

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

        <nav className="hidden items-center justify-end gap-1 lg:flex lg:gap-2" aria-label="Main">
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
          {accountNav ? (
            <AccountNavMenu account={accountNav} overlay={overlay} />
          ) : (
            <>
              <Link
                href="/login"
                className={`rounded-full px-3 py-2 text-sm font-medium transition sm:px-4 ${linkIdle}`}
              >
                Log in
              </Link>
              <Link
                href="/join"
                className={`rounded-full px-3 py-2 text-sm font-medium transition sm:px-4 ${linkIdle}`}
              >
                Join as a partner
              </Link>
              <Link
                href="/signup"
                className={`rounded-full px-4 py-2 text-sm font-semibold transition sm:px-5 ${
                  overlay
                    ? "bg-white text-primary shadow-md hover:bg-white/95"
                    : "bg-primary text-accent shadow-sm hover:bg-primary/90"
                }`}
              >
                Create player account
              </Link>
            </>
          )}
        </nav>

        <button
          type="button"
          onClick={() =>
            setMenuPath((current) => (current === pathname ? null : pathname))
          }
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          className={`flex h-10 w-10 items-center justify-center rounded-full transition lg:hidden ${
            overlay ? "text-white hover:bg-white/10" : "text-primary hover:bg-surface"
          }`}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {menuOpen ? (
        <div className="border-t border-primary/10 bg-white shadow-lg lg:hidden">
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
                  onClick={() => setMenuPath(null)}
                  className={`rounded-xl px-4 py-3 text-base font-medium transition ${
                    active ? "bg-primary/10 text-primary" : "text-primary/75 hover:bg-surface"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            {accountNav ? (
              <AccountNavMenu
                account={accountNav}
                variant="mobile"
                onNavigate={() => setMenuPath(null)}
              />
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMenuPath(null)}
                  className="rounded-xl px-4 py-3 text-base font-medium text-primary/75 transition hover:bg-surface"
                >
                  Log in
                </Link>
                <Link
                  href="/join"
                  onClick={() => setMenuPath(null)}
                  className="rounded-xl px-4 py-3 text-base font-medium text-primary/75 transition hover:bg-surface"
                >
                  Join as a partner
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMenuPath(null)}
                  className="mt-1 rounded-xl bg-primary px-4 py-3 text-center text-base font-semibold text-accent shadow-sm transition hover:bg-primary/90"
                >
                  Create player account
                </Link>
              </>
            )}
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
    (href === "/about" && pathname.startsWith("/about")) ||
    (href === "/contact" && pathname.startsWith("/contact"))
  );
}
