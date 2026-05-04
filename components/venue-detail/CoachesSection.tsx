import Link from "next/link";
import { User } from "lucide-react";
import type { Coach } from "../../lib/coaches";

type CoachesSectionProps = {
  coaches: Coach[];
};

export default function CoachesSection({ coaches }: CoachesSectionProps) {
  if (coaches.length === 0) return null;

  return (
    <section className="space-y-2 border-t border-primary/10 pt-8">
      <div>
        <h2 className="text-xl font-semibold text-primary">Coaches</h2>
        <p className="mt-1 text-sm text-primary/70">Train with our coaches</p>
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
                className="flex gap-4 rounded-2xl border border-primary/15 bg-white p-4 transition hover:border-primary/25 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15"
              >
                {coach.image_url?.trim() ? (
                  <img
                    src={coach.image_url}
                    alt=""
                    className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div
                    className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-xl bg-surface"
                    aria-hidden
                  >
                    <User className="h-8 w-8 text-secondary" strokeWidth={1.25} />
                  </div>
                )}
                <div className="min-w-0 flex-1 py-0.5">
                  <p className="font-semibold text-primary">{name}</p>
                  {level ? (
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-primary/60">{level}</p>
                  ) : null}
                  {specialty ? <p className="mt-1 text-sm text-primary/70">{specialty}</p> : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
