import Link from "next/link";
import { User } from "lucide-react";
import type { Coach } from "../../lib/coaches";

type CoachesSectionProps = {
  coaches: Coach[];
};

export default function CoachesSection({ coaches }: CoachesSectionProps) {
  if (coaches.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Coaches at this venue</h2>
      <ul className="grid gap-4 sm:grid-cols-2">
        {coaches.map((coach) => {
          const name = coach.name?.trim() || "Coach";
          const level = coach.role?.trim();
          return (
            <li key={coach.id}>
              <Link
                href={`/coach/${encodeURIComponent(coach.id)}`}
                className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
              >
                {coach.image_url?.trim() ? (
                  <img
                    src={coach.image_url}
                    alt=""
                    className="h-20 w-20 shrink-0 rounded-xl object-cover ring-1 ring-slate-200"
                  />
                ) : (
                  <div
                    className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-slate-100 ring-1 ring-slate-200"
                    aria-hidden
                  >
                    <User className="h-9 w-9 text-slate-400" strokeWidth={1.25} />
                  </div>
                )}
                <div className="min-w-0 flex-1 py-0.5">
                  <p className="font-semibold text-slate-900">{name}</p>
                  {level ? <p className="mt-1 text-sm text-slate-600">{level}</p> : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
