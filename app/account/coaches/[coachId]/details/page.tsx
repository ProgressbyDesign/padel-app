import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CoachDetailsForm from "@/components/account/CoachDetailsForm";
import { initialCoachDetailsState } from "@/lib/coachManagement";
import { loadManagedCoachDetails } from "@/lib/queries/managedCoach";

export const metadata: Metadata = {
  title: "Coach details",
  description: "Edit coach profile details.",
};

type PageProps = {
  params: Promise<{ coachId: string }>;
};

export default async function ManagedCoachDetailsPage({ params }: PageProps) {
  const { coachId } = await params;
  const result = await loadManagedCoachDetails(coachId);
  if (!result) notFound();

  const { coach, audienceAdults, audienceJuniors, playerLevels, outcomes } =
    result;

  return (
    <section className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-[0_8px_28px_rgba(3,19,34,0.04)] sm:p-7">
      <div>
        <h2 className="text-2xl font-bold text-primary">Basic details</h2>
        <p className="mt-1 text-sm text-primary/60">
          Update the fields players see on your public coach profile.
        </p>
      </div>
      <div className="mt-6">
        <CoachDetailsForm
          coachId={coach.id}
          initialState={initialCoachDetailsState({
            name: coach.name,
            role: coach.role,
            description: coach.description,
            experience_years: coach.experience_years,
            phone: coach.phone,
            email: coach.email,
            travel_available: coach.travel_available,
            price_from: coach.price_from,
            audienceAdults,
            audienceJuniors,
            playerLevels,
            outcomes,
          })}
        />
      </div>
    </section>
  );
}
