import { Building2, UserRoundCheck } from "lucide-react";
import Link from "next/link";

const QUEUES = [
  {
    href: "/admin/applications/coaches",
    title: "Coach applications",
    copy: "Review individual coach applications, match existing profiles, or create approved coaches.",
    icon: UserRoundCheck,
  },
  {
    href: "/admin/applications/venues",
    title: "Venue applications",
    copy: "Review venue claims and new-listing requests, including existing venue ownership.",
    icon: Building2,
  },
] as const;

export default function AdminApplicationsPage() {
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
        Operations
      </p>
      <h1 className="mt-2">Applications</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-primary/60">
        Choose a queue to review submitted partner applications.
      </p>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {QUEUES.map(({ href, title, copy, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-[24px] border border-primary/10 bg-white p-6 shadow-[0_8px_28px_rgba(3,19,34,0.04)] transition hover:-translate-y-0.5 hover:border-primary/20"
          >
            <Icon className="h-6 w-6 text-primary/50" aria-hidden />
            <h2 className="mt-5 text-xl">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-primary/60">{copy}</p>
            <span className="mt-6 inline-block text-sm font-semibold">
              Open queue <span className="transition group-hover:translate-x-1">→</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
