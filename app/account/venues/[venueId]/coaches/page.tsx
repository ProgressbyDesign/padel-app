import type { Metadata } from "next";
import { notFound } from "next/navigation";
import VenueCoachesManager from "@/components/account/VenueCoachesManager";
import { loadManagedVenueShell } from "@/lib/queries/managedVenueShell";
import { loadVenueRelationshipBoard } from "@/lib/queries/coachVenueRelationships";

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

  const board = await loadVenueRelationshipBoard(venueId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-primary">Coaches</h2>
        <p className="mt-1 text-sm text-primary/60">
          Invite coaches, review requests, and manage coaching relationships.
        </p>
      </div>
      <VenueCoachesManager venueId={venueId} board={board} />
    </div>
  );
}
