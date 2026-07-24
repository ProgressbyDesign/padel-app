"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ImageIcon,
  LayoutDashboard,
  Link2,
  PenSquare,
  UserRound,
} from "lucide-react";

const NAV_ITEMS = [
  {
    href: "",
    label: "Overview",
    icon: LayoutDashboard,
    match: (pathname: string, base: string) => pathname === base,
  },
  {
    href: "/details",
    label: "Details",
    icon: PenSquare,
    match: (pathname: string, base: string) =>
      pathname.startsWith(`${base}/details`),
  },
  {
    href: "/images",
    label: "Images",
    icon: ImageIcon,
    match: (pathname: string, base: string) =>
      pathname.startsWith(`${base}/images`),
  },
  {
    href: "/socials",
    label: "Social links",
    icon: Link2,
    match: (pathname: string, base: string) =>
      pathname.startsWith(`${base}/socials`),
  },
  {
    href: "/coaches",
    label: "Coaches",
    icon: UserRound,
    match: (pathname: string, base: string) =>
      pathname.startsWith(`${base}/coaches`),
  },
] as const;

type ManagedVenueNavProps = {
  venueId: string;
};

export default function ManagedVenueNav({ venueId }: ManagedVenueNavProps) {
  const pathname = usePathname() ?? "";
  const base = `/account/venues/${encodeURIComponent(venueId)}`;

  return (
    <nav aria-label="Venue sections">
      <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {NAV_ITEMS.map((item) => {
          const href = `${base}${item.href}`;
          const isCurrent = item.match(pathname, base);
          const Icon = item.icon;

          return (
            <li key={item.href || "overview"} className="shrink-0">
              <Link
                href={href}
                aria-current={isCurrent ? "page" : undefined}
                className={`inline-flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                  isCurrent
                    ? "bg-primary text-accent"
                    : "bg-white text-primary/70 hover:bg-surface hover:text-primary"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
