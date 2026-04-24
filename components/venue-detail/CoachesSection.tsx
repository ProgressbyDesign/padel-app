import Link from "next/link";
import { User } from "lucide-react";
import type { Coach } from "../../lib/coaches";

type CoachesSectionProps = {
  coaches: Coach[];
};

export default function CoachesSection({ coaches }: CoachesSectionProps) {
  if (coaches.length === 0) return null;

  return (
    <section className="space-y-2 border-t border-slate-100 pt-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Coaches</h2>
        <p className="mt-1 text-sm text-slate-600">Train with our coaches</p>
      </div>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {coaches.map((coach) => {
          const name = coach.name?.trim() || "Coach";
          const level = coach.level?.trim() || coach.role?.trim();
          const specialty = coach.specialty?.trim();

          return (
            <li key={coach.id}>
              <Link
                href={`/coach/${encodeURIComponent(coach.id)}`}
                className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15"
              >
                {coach.image_url?.trim() ? (
                  <img
                    src={coach.image_url}
                    alt=""
                    className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div
                    className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-xl bg-slate-100"
                    aria-hidden
                  >
                    <User className="h-8 w-8 text-slate-400" strokeWidth={1.25} />
                  </div>
                )}
                <div className="min-w-0 flex-1 py-0.5">
                  <p className="font-semibold text-slate-900">{name}</p>
                  {level ? (
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">{level}</p>
                  ) : null}
                  {specialty ? <p className="mt-1 text-sm text-slate-600">{specialty}</p> : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
