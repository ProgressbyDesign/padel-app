import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CoachAvailabilityOverview from "@/components/account/CoachAvailabilityOverview";
import { loadCoachAvailabilityAccess } from "@/lib/queries/coachAvailabilityAccess";
import { loadCoachAvailabilityOverview } from "@/lib/queries/coachAvailability";

export const metadata: Metadata = {
  title: "Coach availability",
  description: "Manage coaching availability by venue.",
};

type PageProps = {
  params: Promise<{ coachId: string }>;
};

export default async function ManagedCoachAvailabilityPage({ params }: PageProps) {
  const { coachId } = await params;
  const shell = await loadCoachAvailabilityAccess(coachId);
  if (!shell) notFound();

  const venues = await loadCoachAvailabilityOverview(coachId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl text-primary">Availability</h2>
        <p className="mt-1 text-sm text-primary/60">
          Set weekly hours and exceptions for each active coaching venue.
        </p>
      </div>
      <CoachAvailabilityOverview coachId={coachId} venues={venues} />
    </div>
  );
}
