import Link from "next/link";
import { ArrowUpRight, CalendarClock, MapPin } from "lucide-react";
import CoachImage from "@/components/CoachImage";
import type { MembershipRole } from "@/lib/auth/types";
import type {
  ManagedCoach,
  ManagedVenue,
} from "@/lib/queries/accountDashboard";

function roleLabel(role: MembershipRole): string {
  return role === "owner" ? "Owner" : "Manager";
}

function availabilityLabel(
  status: ManagedCoach["availabilityStatus"]
): { text: string; className: string } {
  if (status === "live") {
    return {
      text: "Live availability",
      className: "bg-emerald-50 text-emerald-900 border-emerald-200",
    };
  }
  if (status === "private") {
    return {
      text: "Private availability",
      className: "bg-amber-50 text-amber-950 border-amber-200",
    };
  }
  return {
    text: "Availability not set",
    className: "bg-surface text-primary/70 border-primary/10",
  };
}

export function ManagedCoachWorkspaceCard({ coach }: { coach: ManagedCoach }) {
  const availability = availabilityLabel(coach.availabilityStatus);
  const manageHref = `/account/coaches/${encodeURIComponent(coach.id)}`;
  const publicHref = `/coach/${encodeURIComponent(coach.id)}`;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[20px] border border-primary/10 bg-white shadow-[0_8px_28px_rgba(3,19,34,0.04)]">
      <div className="relative aspect-[16/10] bg-surface">
        <CoachImage
          src={coach.imageUrl}
          alt=""
          className="h-full w-full object-cover"
        />
        <span className="absolute left-3 top-3 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-primary">
          {roleLabel(coach.membershipRole)}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
          Coach workspace
        </p>
        <h3 className="mt-2 truncate text-xl font-bold text-primary">
          {coach.name}
        </h3>
        {coach.role ? (
          <p className="mt-1 truncate text-sm text-primary/60">{coach.role}</p>
        ) : null}
        {coach.location ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-primary/60">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{coach.location}</span>
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-lg border border-primary/10 bg-surface px-2.5 py-1 text-xs font-semibold text-primary">
            {coach.completionPercent}% complete
          </span>
          <span
            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${availability.className}`}
          >
            {availability.text}
          </span>
          {coach.pendingBookingCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-950">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
              {coach.pendingBookingCount === 1
                ? "1 pending booking"
                : `${coach.pendingBookingCount} pending bookings`}
            </span>
          ) : null}
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-6">
          <Link
            href={manageHref}
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:bg-primary/90"
          >
            Open coach dashboard
          </Link>
          <Link
            href={publicHref}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-primary/15 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-surface"
          >
            View public profile
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}

export function ManagedVenueWorkspaceCard({ venue }: { venue: ManagedVenue }) {
  const manageHref = `/account/venues/${encodeURIComponent(venue.id)}`;
  const publicHref = `/venue/${encodeURIComponent(venue.id)}`;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[20px] border border-primary/10 bg-white shadow-[0_8px_28px_rgba(3,19,34,0.04)]">
      <div className="relative aspect-[16/10] bg-surface">
        {venue.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={venue.imageUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-semibold text-primary/35">
            No image yet
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-primary">
          {roleLabel(venue.membershipRole)}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
          Venue workspace
        </p>
        <h3 className="mt-2 truncate text-xl font-bold text-primary">
          {venue.name}
        </h3>
        {venue.location ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-primary/60">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{venue.location}</span>
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-lg border border-primary/10 bg-surface px-2.5 py-1 text-xs font-semibold text-primary">
            {venue.completionPercent}% complete
          </span>
          {venue.activeCoachCount > 0 ? (
            <span className="rounded-lg border border-primary/10 bg-surface px-2.5 py-1 text-xs font-semibold text-primary/70">
              {venue.activeCoachCount === 1
                ? "1 active coach"
                : `${venue.activeCoachCount} active coaches`}
            </span>
          ) : null}
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-6">
          <Link
            href={manageHref}
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:bg-primary/90"
          >
            Open venue dashboard
          </Link>
          <Link
            href={publicHref}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-primary/15 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-surface"
          >
            View public profile
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}
