import CoachVenueLinker from "@/components/admin/CoachVenueLinker";
import AdminSearchForm from "@/components/admin/AdminSearchForm";
import { AdminPageHeader } from "@/components/admin/ui";
import { fetchCoachesForVenueLinking } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string; all?: string }> };

export default async function AdminCoachVenueLinksPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = sp.q?.trim();
  const showAll = sp.all === "1";

  let coaches: Awaited<ReturnType<typeof fetchCoachesForVenueLinking>> = [];
  let error: string | null = null;

  try {
    coaches = await fetchCoachesForVenueLinking({
      unlinkedOnly: !showAll,
      search: q,
      limit: 40,
    });
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load coaches";
  }

  return (
    <>
      <AdminPageHeader
        title="Coach ↔ venue links"
        description="Default: coaches with no venue links. Match by email domain or description, or search manually."
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <AdminSearchForm action="/admin/coach-venue-links" defaultValue={q} placeholder="Filter coaches by name…" />
        <a
          href={showAll ? "/admin/coach-venue-links" : "/admin/coach-venue-links?all=1"}
          className="text-sm text-secondary underline"
        >
          {showAll ? "Show unlinked only" : "Show all coaches"}
        </a>
      </div>
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      <CoachVenueLinker coaches={coaches} />
    </>
  );
}
