import type { Metadata } from "next";
import { notFound } from "next/navigation";
import VenueCombinedAvailabilityPreview from "@/components/account/VenueCombinedAvailabilityPreview";
import VenueCoachesManager from "@/components/account/VenueCoachesManager";
import { loadManagedVenueShell } from "@/lib/queries/managedVenueShell";
import { loadVenueRelationshipBoard } from "@/lib/queries/coachVenueRelationships";
import {
  loadVenueCoachAvailabilityHints,
  loadVenueCombinedAvailabilityPreview,
} from "@/lib/queries/coachAvailability";

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
  const activeIds = board.current
    .filter((row) => row.status === "active")
    .map((row) => row.id);
  const [availabilityHints, combinedPreview] = await Promise.all([
    loadVenueCoachAvailabilityHints(venueId, activeIds),
    loadVenueCombinedAvailabilityPreview(venueId, 14),
  ]);
  const availability = Object.fromEntries(availabilityHints.entries());

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-primary">Coaches</h2>
        <p className="mt-1 text-sm text-primary/60">
          Invite coaches, review requests, and manage coaching relationships.
        </p>
      </div>
      <VenueCombinedAvailabilityPreview
        slots={combinedPreview.slots}
        hasActiveCoaches={combinedPreview.hasActiveCoaches}
      />
      <VenueCoachesManager
        venueId={venueId}
        board={board}
        availability={availability}
      />
    </div>
  );
}
