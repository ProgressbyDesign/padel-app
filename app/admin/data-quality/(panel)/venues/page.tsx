import Link from "next/link";
import AdminSearchForm from "@/components/admin/AdminSearchForm";
import {
  AdminEmpty,
  AdminPageHeader,
  AdminTable,
  AdminTd,
  AdminTh,
  PaginationBar,
  qualityBadge,
} from "@/components/admin/ui";
import { fetchAdminVenuesList } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ page?: string; q?: string }> };

export default async function AdminVenuesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim();

  let rows: Awaited<ReturnType<typeof fetchAdminVenuesList>>["rows"] = [];
  let total = 0;
  let pageSize = 25;
  let error: string | null = null;

  try {
    const res = await fetchAdminVenuesList({ page, search: q });
    rows = res.rows;
    total = res.total;
    pageSize = res.pageSize;
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load venues";
  }

  return (
    <>
      <AdminPageHeader title="Venues" description="Review and edit imported venue records." />
      <AdminSearchForm action="/admin/data-quality/venues" defaultValue={q} placeholder="Search venuesâ€¦" />
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      {rows.length === 0 ? (
        <AdminEmpty message="No venues found." />
      ) : (
        <>
          <AdminTable>
            <thead>
              <tr>
                <AdminTh>Name</AdminTh>
                <AdminTh>Location</AdminTh>
                <AdminTh>Website</AdminTh>
                <AdminTh>Courts</AdminTh>
                <AdminTh>Type</AdminTh>
                <AdminTh>AI conf.</AdminTh>
                <AdminTh>Status</AdminTh>
                <AdminTh>Crawled</AdminTh>
                <AdminTh />
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id}>
                  <AdminTd>{v.name ?? "â€”"}</AdminTd>
                  <AdminTd>
                    {[v.city, v.country].filter(Boolean).join(", ") || "â€”"}
                  </AdminTd>
                  <AdminTd className="max-w-[140px] truncate">
                    {v.website ? (
                      <a href={v.website} target="_blank" rel="noreferrer" className="text-secondary underline">
                        {v.website}
                      </a>
                    ) : (
                      "â€”"
                    )}
                  </AdminTd>
                  <AdminTd>{v.courts ?? "â€”"}</AdminTd>
                  <AdminTd>
                    {[v.court_type, v.venue_type].filter(Boolean).join(" / ") || "â€”"}
                  </AdminTd>
                  <AdminTd>{v.ai_confidence ?? "â€”"}</AdminTd>
                  <AdminTd>{qualityBadge(v.data_quality_status, v.is_approved)}</AdminTd>
                  <AdminTd className="text-xs text-primary/50">
                    {v.last_crawled_at ? new Date(v.last_crawled_at).toLocaleDateString() : "â€”"}
                  </AdminTd>
                  <AdminTd>
                    <Link href={`/admin/data-quality/venues/${v.id}`} className="text-sm text-secondary underline">
                      Edit
                    </Link>
                  </AdminTd>
                </tr>
              ))}
            </tbody>
          </AdminTable>
          <PaginationBar
            page={page}
            total={total}
            pageSize={pageSize}
            basePath="/admin/data-quality/venues"
            searchParams={{ q }}
          />
        </>
      )}
    </>
  );
}
