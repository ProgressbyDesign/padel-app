import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import VenueOperationalSchedule from "@/components/account/VenueOperationalSchedule";
import { loadManagedVenueShell } from "@/lib/queries/managedVenueShell";
import { loadVenueOperationalSchedule } from "@/lib/queries/venueOperations";

export const metadata: Metadata = {
  title: "Venue schedule",
  description: "Operational coaching calendar for this venue.",
};

type PageProps = {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{
    coach?: string;
    visibility?: string;
    states?: string;
  }>;
};

function ScheduleSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-28 rounded-[24px] border border-primary/10 bg-surface/60" />
      <div className="h-96 rounded-[24px] border border-primary/10 bg-surface/60" />
    </div>
  );
}

export default async function ManagedVenueSchedulePage({
  params,
  searchParams,
}: PageProps) {
  const { venueId } = await params;
  await searchParams;
  const shell = await loadManagedVenueShell(venueId);
  if (!shell) notFound();

  const schedule = await loadVenueOperationalSchedule(venueId, 14);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-primary">Schedule</h2>
        <p className="mt-1 text-sm text-primary/60">
          Combined operational calendar for active coaches at this venue.
          Reserved sessions hide player contact details.
        </p>
      </div>

      <Suspense fallback={<ScheduleSkeleton />}>
        <VenueOperationalSchedule
          venueId={venueId}
          venueName={schedule.venueName}
          slots={schedule.slots}
          hasActiveCoaches={schedule.hasActiveCoaches}
          primaryTimezone={schedule.primaryTimezone}
          timezoneInconsistency={schedule.timezoneInconsistency}
          coaches={schedule.coaches}
        />
      </Suspense>
    </div>
  );
}
