import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import type { MembershipRole } from "@/lib/auth/types";

type ManagedListingCardProps = {
  kind: "coach" | "venue";
  id: string;
  name: string;
  membershipRole: MembershipRole;
  location?: string;
  publicHref?: string;
};

function roleLabel(role: MembershipRole): string {
  return role === "owner" ? "Owner" : "Manager";
}

export default function ManagedListingCard({
  kind,
  id,
  name,
  membershipRole,
  location,
  publicHref,
}: ManagedListingCardProps) {
  const manageHref =
    kind === "coach" ? `/account/coaches/${id}` : `/account/venues/${id}`;

  return (
    <article className="flex h-full flex-col rounded-[20px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/45">
            {kind === "coach" ? "Coach profile" : "Venue"}
          </p>
          <h3 className="mt-2 truncate text-xl font-bold text-primary">{name}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-primary">
          {roleLabel(membershipRole)}
        </span>
      </div>

      {location ? (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-primary/60">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{location}</span>
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-6">
        <Link
          href={manageHref}
          className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:bg-primary/90"
        >
          Manage
        </Link>
        {publicHref ? (
          <Link
            href={publicHref}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-primary/15 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-surface"
          >
            View public page
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        ) : null}
      </div>
    </article>
  );
}
