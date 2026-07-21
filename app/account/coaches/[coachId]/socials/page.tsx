import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CoachSocialManager from "@/components/account/CoachSocialManager";
import { loadManagedCoachSocials } from "@/lib/queries/managedCoach";

export const metadata: Metadata = {
  title: "Coach social links",
  description: "Manage coach social media links.",
};

type PageProps = {
  params: Promise<{ coachId: string }>;
};

export default async function ManagedCoachSocialsPage({ params }: PageProps) {
  const { coachId } = await params;
  const socials = await loadManagedCoachSocials(coachId);
  if (!socials) notFound();

  return <CoachSocialManager coachId={coachId} socials={socials} />;
}
