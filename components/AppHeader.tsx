"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import AccountNavMenu from "@/components/AccountNavMenu";
import PadelPathwaysLogo from "@/components/brand/PadelPathwaysLogo";
import JoinMobileSection from "@/components/join/JoinMobileSection";
import JoinNavMenu from "@/components/join/JoinNavMenu";
import type { AccountNavContext } from "@/lib/workspace/resolve";

const nav = [
  { href: "/", label: "Home" },
  { href: "/venues", label: "Venues" },
  { href: "/coaches", label: "Coaches" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact" },
] as const;



export default function AppHeader({
  accountNav,
}: {
  accountNav: AccountNavContext | null;
}) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const menuOpen = menuPath === pathname;



  const overlay = true;
  const headerPosition = isHome ? "fixed top-0 left-0 right-0" : "sticky top-0";

  const headerSurface = "border-b border-white/10 bg-primary shadow-sm";

  const linkIdle = overlay
    ? "text-white/85 hover:bg-white/10 hover:text-white"
    : "text-primary/70 hover:bg-surface hover:text-primary";

  const linkActive = overlay ? "bg-white/15 text-white" : "bg-primary/10 text-primary";

  return (
    <header className={`${headerPosition} z-50 transition-colors duration-300 ${headerSurface}`}>
      <div className="mx-auto flex h-16 max-w-[1680px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-[120px]">
        <PadelPathwaysLogo variant="white" />

        <nav className="hidden items-center justify-end gap-1 flex-1 lg:flex lg:gap-2" aria-label="Main">
         <div className="mx-auto"> {nav.map((item) => {
            const active = isNavActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-2 text-sm font-heading transition sm:px-4 text-xs ${
                  active ? linkActive : linkIdle
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          </div>
          {accountNav ? (
            <AccountNavMenu account={accountNav} overlay={overlay} />
          ) : (
            <>
              <JoinNavMenu overlay={overlay} />
              <Link
                href="/login"
                data-cta="header-login"
                className="rounded-full border border-accent px-5 py-2 text-xs font-heading text-accent transition hover:bg-accent hover:text-primary"
              >
                Log in
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
        <div className="border-t border-white/15 bg-primary shadow-lg lg:hidden">
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
                  className={`rounded-xl px-4 py-3 text-base font-heading font-semibold transition ${
                    active ? "bg-white/15 text-white" : "text-white/85 hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            {accountNav ? (
              <div className="rounded-2xl bg-white"><AccountNavMenu
                account={accountNav}
                variant="mobile"
                onNavigate={() => setMenuPath(null)}
              /></div>
            ) : (
              <>
                <JoinMobileSection onNavigate={() => setMenuPath(null)} />
                <Link
                  href="/login"
                  data-cta="header-login-mobile"
                  onClick={() => setMenuPath(null)}
                  className="mt-1 rounded-xl border border-accent px-4 py-3 text-base font-heading text-accent transition hover:bg-white/10"
                >
                  Log in
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
