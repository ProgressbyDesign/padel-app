import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CoachVenuesManager from "@/components/account/CoachVenuesManager";
import { loadManagedCoachShell } from "@/lib/queries/managedCoachShell";
import { loadCoachRelationshipBoard } from "@/lib/queries/coachVenueRelationships";

export const metadata: Metadata = {
  title: "Coach venues",
  description: "Manage coaching venue relationships.",
};

type PageProps = {
  params: Promise<{ coachId: string }>;
};

export default async function ManagedCoachVenuesPage({ params }: PageProps) {
  const { coachId } = await params;
  const shell = await loadManagedCoachShell(coachId);
  if (!shell) notFound();

  const board = await loadCoachRelationshipBoard(coachId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-primary">Venues</h2>
        <p className="mt-1 text-sm text-primary/60">
          Request venues, respond to invitations, and manage your coaching locations.
        </p>
      </div>
      <CoachVenuesManager coachId={coachId} board={board} />
    </div>
  );
}
