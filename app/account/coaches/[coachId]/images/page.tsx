import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CoachImageManager from "@/components/account/CoachImageManager";
import { sortCoachImages, type CoachImageRow } from "@/lib/coachImages";
import { loadManagedCoachImages } from "@/lib/queries/managedCoach";
import { loadManagedCoachShell } from "@/lib/queries/managedCoachShell";

export const metadata: Metadata = {
  title: "Coach images",
  description: "Manage coach gallery images.",
};

type PageProps = {
  params: Promise<{ coachId: string }>;
};

export default async function ManagedCoachImagesPage({ params }: PageProps) {
  const { coachId } = await params;
  const [shell, images] = await Promise.all([
    loadManagedCoachShell(coachId),
    loadManagedCoachImages(coachId),
  ]);
  if (!shell || !images) notFound();

  const rows: CoachImageRow[] = sortCoachImages(
    images.map((image) => ({
      id: image.id,
      coach_id: coachId,
      image_url: image.image_url,
      is_primary: Boolean(image.is_primary),
      created_at: image.created_at ?? null,
    }))
  );

  return (
    <CoachImageManager
      coachId={coachId}
      coachName={shell.name?.trim() || "Coach"}
      images={rows}
    />
  );
}
