import Link from "next/link";
import { notFound } from "next/navigation";
import VenueEditPanel from "@/components/admin/VenueEditPanel";
import { AdminBadge, AdminPageHeader } from "@/components/admin/ui";
import { fetchAdminVenueDetail } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AdminVenueDetailPage({ params }: Props) {
  const { id } = await params;
  let venue = null;
  let socials: Awaited<ReturnType<typeof fetchAdminVenueDetail>>["socials"] = [];
  let error: string | null = null;

  try {
    const res = await fetchAdminVenueDetail(id);
    venue = res.venue;
    socials = res.socials;
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load venue";
  }

  if (!error && !venue) notFound();

  return (
    <>
      <AdminPageHeader
        title={venue?.name ?? "Venue"}
        description={venue ? [venue.city, venue.country].filter(Boolean).join(", ") : undefined}
      >
        <Link href="/admin/venues" className="text-sm text-secondary underline">
          ← All venues
        </Link>
      </AdminPageHeader>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {venue ? (
        <div className="mb-4 flex flex-wrap gap-2 text-sm text-primary/70">
          {venue.website ? (
            <a href={venue.website} target="_blank" rel="noreferrer" className="underline">
              {venue.website}
            </a>
          ) : null}
          {venue.ai_confidence != null ? (
            <AdminBadge>AI confidence {venue.ai_confidence}</AdminBadge>
          ) : null}
        </div>
      ) : null}
      {venue ? <VenueEditPanel venue={venue} socials={socials} /> : null}
    </>
  );
}
