import Link from "next/link";
import { ArrowUpRight, ChevronLeft, MapPin } from "lucide-react";
import type { MembershipRole } from "@/lib/auth/types";

function roleLabel(role: MembershipRole): string {
  return role === "owner" ? "Owner" : "Manager";
}

function readableStatus(value: string | null): string {
  if (!value) return "Not assessed";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

type ManagedVenueHeaderProps = {
  venueId: string;
  name: string | null;
  city: string | null;
  country: string | null;
  membershipRole: MembershipRole;
  isApproved: boolean | null;
  dataQualityStatus: string | null;
};

export default function ManagedVenueHeader({
  venueId,
  name,
  city,
  country,
  membershipRole,
  isApproved,
  dataQualityStatus,
}: ManagedVenueHeaderProps) {
  const venueName = name?.trim() || "Venue";
  const location = [city, country].filter(Boolean).join(", ");

  return (
    <div>
      <nav aria-label="Breadcrumb">
        <Link
          href="/account"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary/60 transition hover:text-primary"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back to account
        </Link>
      </nav>

      <header className="mt-6 flex flex-col gap-5 border-b border-primary/10 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
            Venue management
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
              {venueName}
            </h1>
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-primary">
              {roleLabel(membershipRole)}
            </span>
            <span className="rounded-full border border-primary/10 bg-white px-2.5 py-1 text-xs font-semibold text-primary/70">
              {isApproved ? "Approved" : "Pending approval"}
            </span>
            <span className="rounded-full border border-primary/10 bg-white px-2.5 py-1 text-xs font-semibold text-primary/70">
              {readableStatus(dataQualityStatus)}
            </span>
          </div>
          {location ? (
            <p className="mt-3 flex items-center gap-1.5 text-base text-primary/60">
              <MapPin className="h-4 w-4" aria-hidden />
              {location}
            </p>
          ) : null}
        </div>

        <Link
          href={`/venue/${encodeURIComponent(venueId)}`}
          className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl border border-primary/15 bg-white px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-surface lg:self-auto"
        >
          View public page
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </Link>
      </header>
    </div>
  );
}
