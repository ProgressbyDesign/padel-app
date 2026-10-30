"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, BadgeCheck, ClipboardList, ArrowUpRight, RotateCcw } from "lucide-react";
import { useDevelopmentPreview } from "./DevelopmentPreviewProvider";

const sections = [
  { href: "/account/development", label: "My Development", Icon: BookOpen },
  { href: "/account/development/passport", label: "My Passport", Icon: BadgeCheck },
  { href: "/account/development/assessments", label: "My Assessments", Icon: ClipboardList },
  { href: "/account/development/next-step", label: "My Next Step", Icon: ArrowUpRight },
];

export default function DevelopmentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { reset } = useDevelopmentPreview();
  return <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-10">
    <Link href="/account/personal" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">← Account dashboard</Link>
    <div className="mb-7 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p className="max-w-3xl leading-6"><strong>Development preview · sample content.</strong> This is not your real Passport. Practice changes are temporary and reset on reload. No assessments, payments or verified achievements are created.</p>
      <button onClick={reset} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 font-semibold underline focus-visible:outline-2 focus-visible:outline-offset-2"><RotateCcw size={16} aria-hidden />Reset preview</button>
    </div>
    <div className="grid gap-7 lg:grid-cols-[215px_minmax(0,1fr)]">
      <aside><nav aria-label="Player development" className="grid grid-cols-2 gap-2 lg:sticky lg:top-24 lg:grid-cols-1">
        {sections.map(({ href, label, Icon }) => {
          const active = href === "/account/development" ? pathname === href || pathname.startsWith(`${href}/skills/`) : pathname === href;
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-12 items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 ${active ? "bg-primary text-accent" : "bg-white text-primary hover:bg-secondary/30"}`}><Icon size={18} className="shrink-0" aria-hidden />{label}</Link>;
        })}
        <Link href="/account/bookings" className="mt-2 flex min-h-11 items-center px-3 text-sm font-semibold underline underline-offset-4">My bookings →</Link>
      </nav></aside>
      <div className="min-w-0">{children}</div>
    </div>
  </div>;
}
