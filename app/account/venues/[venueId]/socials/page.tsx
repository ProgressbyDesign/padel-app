import type { Metadata } from "next";
import { notFound } from "next/navigation";
import VenueSocialManager from "@/components/account/VenueSocialManager";
import { loadManagedVenueSocialRows } from "@/lib/queries/managedVenue";

export const metadata: Metadata = {
  title: "Venue social links",
  description: "Manage venue social media links on Padel Pathways.",
};

type PageProps = {
  params: Promise<{ venueId: string }>;
};

export default async function ManagedVenueSocialsPage({ params }: PageProps) {
  const { venueId } = await params;
  const socials = await loadManagedVenueSocialRows(venueId);
  if (!socials) notFound();

  return <VenueSocialManager venueId={venueId} socials={socials} />;
}
