import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CoachAvailabilityEditor from "@/components/account/CoachAvailabilityEditor";
import { loadCoachAvailabilityAccess } from "@/lib/queries/coachAvailabilityAccess";
import { loadAvailabilityEditorBundle } from "@/lib/queries/coachAvailability";

export const metadata: Metadata = {
  title: "Edit availability",
  description: "Edit coaching availability for a venue.",
};

type PageProps = {
  params: Promise<{ coachId: string; relationshipId: string }>;
};

export default async function ManagedCoachAvailabilityEditorPage({
  params,
}: PageProps) {
  const { coachId, relationshipId } = await params;
  const shell = await loadCoachAvailabilityAccess(coachId);
  if (!shell) notFound();

  const bundle = await loadAvailabilityEditorBundle(coachId, relationshipId);
  if (!bundle) notFound();

  return (
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
    />
  );
}
