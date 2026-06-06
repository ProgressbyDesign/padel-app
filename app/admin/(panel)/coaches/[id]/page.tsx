import Link from "next/link";
import { notFound } from "next/navigation";
import CoachEditPanel from "@/components/admin/CoachEditPanel";
import { AdminPageHeader } from "@/components/admin/ui";
import { fetchAdminCoachDetail } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AdminCoachDetailPage({ params }: Props) {
  const { id } = await params;
  let coach = null;
  let links: Awaited<ReturnType<typeof fetchAdminCoachDetail>>["links"] = [];
  let outcomes: Awaited<ReturnType<typeof fetchAdminCoachDetail>>["outcomes"] = [];
  let socials: Awaited<ReturnType<typeof fetchAdminCoachDetail>>["socials"] = [];
  let images: Awaited<ReturnType<typeof fetchAdminCoachDetail>>["images"] = [];
  let error: string | null = null;

  try {
    const res = await fetchAdminCoachDetail(id);
    coach = res.coach;
    links = res.links;
    outcomes = res.outcomes;
    socials = res.socials;
    images = res.images;
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load coach";
  }

  if (!error && !coach) notFound();

  return (
    <>
      <AdminPageHeader title={coach?.name ?? "Coach"} description={coach?.role ?? undefined}>
        <Link href="/admin/coaches" className="text-sm text-secondary underline">
          ← All coaches
        </Link>
      </AdminPageHeader>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {coach ? (
        <CoachEditPanel
          coach={coach}
          links={links}
          outcomes={outcomes}
          socials={socials}
          images={images}
        />
      ) : null}
    </>
  );
}
