import AdminRelationshipsPanel from "@/components/admin/AdminRelationshipsPanel";
import {
  countAdminRelationshipBuckets,
  listAdminCoachVenueRelationships,
} from "@/lib/admin/relationshipQueries";
import { loadAvailabilityMetaForRelationships } from "@/lib/queries/coachAvailability";

type PageProps = {
  searchParams: Promise<{
    status?: string;
    initiated_by?: string;
    coach?: string;
    venue?: string;
  }>;
};

export default async function AdminRelationshipsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const [rows, buckets] = await Promise.all([
    listAdminCoachVenueRelationships({
      status: params.status,
      initiatedBy: params.initiated_by,
      coach: params.coach,
      venue: params.venue,
    }),
    countAdminRelationshipBuckets(),
  ]);

  const availabilityMeta = await loadAvailabilityMetaForRelationships(
    rows.map((row) => row.id)
  );
  const availability = Object.fromEntries(availabilityMeta.entries());

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/45">
          Operations
        </p>
        <h1 className="mt-2">Relationships</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-primary/60">
          Review pending coach–venue requests, verify imported associations, and
          correct active links.
        </p>
      </div>
      <AdminRelationshipsPanel
        rows={rows}
        buckets={buckets}
        initialStatus={params.status ?? null}
        availability={availability}
      />
    </div>
  );
}
