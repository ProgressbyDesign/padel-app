import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CoachLocationsManager from "@/components/account/CoachLocationsManager";
import { loadManagedCoachLocations } from "@/lib/queries/coachLocations";

export const metadata: Metadata = {
  title: "Coach locations",
  description: "Manage where you coach.",
};

type PageProps = {
  params: Promise<{ coachId: string }>;
};

export default async function ManagedCoachLocationsPage({ params }: PageProps) {
  const { coachId } = await params;
  const locations = await loadManagedCoachLocations(coachId);
  if (!locations) notFound();

  return (
    <section className="rounded-[24px] border border-primary/10 bg-white p-5 sm:p-7">
      <CoachLocationsManager coachId={coachId} locations={locations} />
    </section>
  );
}
