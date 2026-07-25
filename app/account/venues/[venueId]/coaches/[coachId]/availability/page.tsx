import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CoachAvailabilityEditor from "@/components/account/CoachAvailabilityEditor";
import { loadManagedVenueShell } from "@/lib/queries/managedVenueShell";
import { loadAvailabilityEditorBundle } from "@/lib/queries/coachAvailability";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Coach availability",
  description: "View coach availability at this venue.",
};

type PageProps = {
  params: Promise<{ venueId: string; coachId: string }>;
};

export default async function VenueCoachAvailabilityReadOnlyPage({
  params,
}: PageProps) {
  const { venueId, coachId } = await params;
  const shell = await loadManagedVenueShell(venueId);
  if (!shell) notFound();

  const supabase = await createClient();
  const { data: relationship } = await supabase
    .from("coach_venues")
    .select("id, status")
    .eq("venue_id", venueId)
    .eq("coach_id", coachId)
    .eq("status", "active")
    .maybeSingle();

  if (!relationship) notFound();

  const bundle = await loadAvailabilityEditorBundle(
    coachId,
    String(relationship.id)
  );
  if (!bundle) notFound();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-primary">Coach schedule</h2>
        <p className="mt-1 text-sm text-primary/60">
          Venue managers can view this schedule but cannot edit it.
        </p>
      </div>
      <CoachAvailabilityEditor
        coachId={coachId}
        venue={bundle.venue}
        settings={bundle.settings}
        rules={bundle.rules}
        exceptions={bundle.exceptions}
        previewSlots={bundle.previewSlots}
        suggestedTimezone={bundle.suggestedTimezone}
        acceptedRanges={bundle.acceptedRanges}
        requestCounts={bundle.requestCounts}
        readOnly
      />
    </div>
  );
}
