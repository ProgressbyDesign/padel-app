import type { Metadata } from "next";
import { notFound } from "next/navigation";
import VenueImageManager from "@/components/account/VenueImageManager";
import { loadManagedVenueImages } from "@/lib/queries/managedVenue";
import { loadManagedVenueShell } from "@/lib/queries/managedVenueShell";

export const metadata: Metadata = {
  title: "Venue images",
  description: "Manage venue gallery images on Padel Pathways.",
};

type PageProps = {
  params: Promise<{ venueId: string }>;
};

export default async function ManagedVenueImagesPage({ params }: PageProps) {
  const { venueId } = await params;
  const [shell, images] = await Promise.all([
    loadManagedVenueShell(venueId),
    loadManagedVenueImages(venueId),
  ]);
  if (!shell || !images) notFound();

  return (
    <VenueImageManager
      venueId={shell.id}
      venueName={shell.name?.trim() || "Venue"}
      images={images}
    />
  );
}
