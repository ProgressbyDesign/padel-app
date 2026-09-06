import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import VenueCoachesManager from "@/components/account/VenueCoachesManager";
import { loadManagedVenueShell } from "@/lib/queries/managedVenueShell";
import { loadVenueRelationshipBoard } from "@/lib/queries/coachVenueRelationships";
import { loadVenueCoachHealth } from "@/lib/queries/venueOperations";

export const metadata: Metadata = {
  title: "Venue coaches",
  description: "Manage coach relationships for this venue.",
};

type PageProps = {
  params: Promise<{ venueId: string }>;
};

export default async function ManagedVenueCoachesPage({ params }: PageProps) {
  const { venueId } = await params;
  const shell = await loadManagedVenueShell(venueId);
  if (!shell) notFound();

  const [board, healthList] = await Promise.all([
    loadVenueRelationshipBoard(venueId),
    loadVenueCoachHealth(venueId),
  ]);

  const health = Object.fromEntries(
    healthList.map((row) => [row.relationshipId, row])
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl text-primary">Coaches</h2>
          <p className="mt-1 text-sm text-primary/60">
            Invite coaches, review requests, and manage coaching relationships.
          </p>
        </div>
        <Link
          href={`/account/venues/${encodeURIComponent(venueId)}/schedule`}
          className="inline-flex min-h-10 items-center rounded-xl border border-primary/15 px-4 text-sm font-semibold text-primary hover:bg-surface"
        >
          View combined schedule
        </Link>
      </div>
      <VenueCoachesManager
        venueId={venueId}
        venueName={shell.name?.trim() || "Venue"}
        board={board}
        health={health}
      />
    </div>
  );
}
