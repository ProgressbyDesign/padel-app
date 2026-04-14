import Link from "next/link";
import { ArrowLeft, User } from "lucide-react";
import type { Coach } from "../lib/coaches";
import type { Venue } from "../lib/venueFilters";
import VenueCardsWithDistance from "./VenueCardsWithDistance";

type CoachProfilePageProps = {
  coach: Coach;
  venues: Venue[];
};

export default function CoachProfilePage({ coach, venues }: CoachProfilePageProps) {
  const displayName = coach.name?.trim() || "Coach";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/venues"
        className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to venues
      </Link>

      <header className="flex flex-col gap-6 border-b border-slate-100 pb-10 sm:flex-row sm:items-start sm:gap-8">
        {coach.image_url?.trim() ? (
          <img
            src={coach.image_url}
            alt=""
            className="h-32 w-32 shrink-0 rounded-2xl object-cover ring-1 ring-slate-200 sm:h-40 sm:w-40"
          />
        ) : (
          <div
            className="flex h-32 w-32 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 ring-1 ring-slate-200/80 sm:h-40 sm:w-40"
            aria-hidden
          >
            <User className="h-14 w-14 text-slate-400 sm:h-16 sm:w-16" strokeWidth={1.25} />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{displayName}</h1>
          {coach.role?.trim() ? (
            <p className="mt-2 text-base font-medium text-slate-600">{coach.role.trim()}</p>
          ) : null}
          {coach.description?.trim() ? (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">{coach.description.trim()}</p>
          ) : null}
        </div>
      </header>

      <section className="mt-10 sm:mt-12">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">Coaches at</h2>
        <p className="mt-1 text-sm text-slate-600">Venues where this coach is listed.</p>

        {venues.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-800">No venues linked yet</p>
            <p className="mt-1 text-sm text-slate-600">Check back later or explore all venues.</p>
            <Link
              href="/venues"
              className="mt-4 inline-block rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Explore venues
            </Link>
          </div>
        ) : (
          <VenueCardsWithDistance
            venues={venues}
            className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          />
        )}
      </section>
    </div>
  );
}
