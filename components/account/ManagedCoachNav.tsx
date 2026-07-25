"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  Building2,
  CalendarCheck2,
  CalendarClock,
  ImageIcon,
  LayoutDashboard,
  Link2,
  MapPin,
  PenSquare,
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
    href: "/locations",
    label: "Locations",
    icon: MapPin,
    match: (pathname: string, base: string) =>
      pathname.startsWith(`${base}/locations`),
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
    href: "/achievements",
    label: "Achievements",
    icon: Award,
    match: (pathname: string, base: string) =>
      pathname.startsWith(`${base}/achievements`),
  },
  {
    href: "/venues",
    label: "Venues",
    icon: Building2,
    match: (pathname: string, base: string) =>
      pathname.startsWith(`${base}/venues`),
  },
  {
    href: "/availability",
    label: "Availability",
    icon: CalendarClock,
    match: (pathname: string, base: string) =>
      pathname.startsWith(`${base}/availability`),
  },
  {
    href: "/bookings",
    label: "Bookings",
    icon: CalendarCheck2,
    match: (pathname: string, base: string) =>
      pathname.startsWith(`${base}/bookings`),
  },
] as const;

export default function ManagedCoachNav({ coachId }: { coachId: string }) {
  const pathname = usePathname() ?? "";
  const base = `/account/coaches/${encodeURIComponent(coachId)}`;

  return (
    <nav aria-label="Coach sections">
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
                className={`inline-flex min-h-11 w-full items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
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
