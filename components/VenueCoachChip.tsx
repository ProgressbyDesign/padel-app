import Link from "next/link";
import { User } from "lucide-react";
import type { Coach } from "../lib/coaches";

type VenueCoachChipProps = {
  coach: Coach;
};

export default function VenueCoachChip({ coach }: VenueCoachChipProps) {
  const name = coach.name?.trim() || "Coach";
  const role = coach.role?.trim();

  return (
    <Link
      href={`/coach/${encodeURIComponent(coach.id)}`}
      className="flex min-h-[52px] items-center gap-3 rounded-xl border border-slate-200/90 bg-white px-3 py-2 shadow-sm transition hover:border-slate-300 hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15"
    >
      {coach.image_url?.trim() ? (
        <img
          src={coach.image_url}
          alt=""
          className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-slate-200/80"
        />
      ) : (
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200/60"
          aria-hidden
        >
          <User className="h-5 w-5 text-slate-400" strokeWidth={1.5} />
        </div>
      )}
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium text-slate-900">{name}</p>
        {role ? <p className="truncate text-xs text-slate-500">{role}</p> : null}
      </div>
    </Link>
  );
}
