import Link from "next/link";
import { ArrowUpRight, ChevronLeft, MapPin } from "lucide-react";
import type { MembershipRole } from "@/lib/auth/types";

function roleLabel(role: MembershipRole): string {
  return role === "owner" ? "Owner" : "Manager";
}

type ManagedCoachHeaderProps = {
  coachId: string;
  name: string | null;
  membershipRole: MembershipRole;
  isApproved: boolean | null;
  primaryLocation: string | null;
  coachingRole: string | null;
};

export default function ManagedCoachHeader({
  coachId,
  name,
  membershipRole,
  isApproved,
  primaryLocation,
  coachingRole,
}: ManagedCoachHeaderProps) {
  const coachName = name?.trim() || "Coach profile";

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
            Coach management
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
              {coachName}
            </h1>
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-primary">
              {roleLabel(membershipRole)}
            </span>
            {isApproved ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900">
                Confirmed
              </span>
            ) : (
              <span className="rounded-full border border-primary/10 bg-white px-2.5 py-1 text-xs font-semibold text-primary/70">
                Pending confirmation
              </span>
            )}
          </div>
          {coachingRole ? (
            <p className="mt-3 text-base text-primary/60">{coachingRole}</p>
          ) : null}
          {primaryLocation ? (
            <p className="mt-2 flex items-center gap-1.5 text-base text-primary/60">
              <MapPin className="h-4 w-4" aria-hidden />
              {primaryLocation}
            </p>
          ) : null}
        </div>

        <Link
          href={`/coach/${encodeURIComponent(coachId)}`}
          className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl border border-primary/15 bg-white px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-surface lg:self-auto"
        >
          View public profile
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </Link>
      </header>
    </div>
  );
}
