import Image from "next/image";
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
import { fetchAdminCoachesList } from "@/lib/admin/queries";
import type { AdminCoachRow } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

function venueLabels(coach: AdminCoachRow): string {
  const links = coach.coach_venues ?? [];
  const names = links
    .map((l) => {
      const v = l.venues;
      if (!v) return null;
      const row = Array.isArray(v) ? v[0] : v;
      return row?.name;
    })
    .filter(Boolean);
  return names.length ? names.join(", ") : "—";
}

type Props = { searchParams: Promise<{ page?: string; q?: string }> };

export default async function AdminCoachesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim();

  let rows: AdminCoachRow[] = [];
  let total = 0;
  let pageSize = 25;
  let error: string | null = null;

  try {
    const res = await fetchAdminCoachesList({ page, search: q });
    rows = res.rows;
    total = res.total;
    pageSize = res.pageSize;
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load coaches";
  }

  return (
    <>
      <AdminPageHeader title="Coaches" description="Review coaches; location on site uses linked venues." />
      <AdminSearchForm action="/admin/coaches" defaultValue={q} placeholder="Search coaches…" />
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      {rows.length === 0 ? (
        <AdminEmpty message="No coaches found." />
      ) : (
        <>
          <AdminTable>
            <thead>
              <tr>
                <AdminTh>Image</AdminTh>
                <AdminTh>Name</AdminTh>
                <AdminTh>Role / level</AdminTh>
                <AdminTh>Contact</AdminTh>
                <AdminTh>Price</AdminTh>
                <AdminTh>Venues</AdminTh>
                <AdminTh>Status</AdminTh>
                <AdminTh />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <AdminTd>
                    {c.image_url ? (
                      <div className="relative h-10 w-10 overflow-hidden rounded">
                        <Image src={c.image_url} alt="" fill className="object-cover" unoptimized />
                      </div>
                    ) : (
                      <span className="text-xs text-primary/40">—</span>
                    )}
                  </AdminTd>
                  <AdminTd>{c.name ?? "—"}</AdminTd>
                  <AdminTd>
                    {[c.role, c.level].filter(Boolean).join(" · ") || "—"}
                  </AdminTd>
                  <AdminTd className="text-xs">
                    {c.email ?? "—"}
                    {c.phone ? <br /> : null}
                    {c.phone ?? ""}
                  </AdminTd>
                  <AdminTd>{c.price_from ?? "—"}</AdminTd>
                  <AdminTd className="max-w-[160px] text-xs">{venueLabels(c)}</AdminTd>
                  <AdminTd>{qualityBadge(c.data_quality_status, c.is_approved)}</AdminTd>
                  <AdminTd>
                    <Link href={`/admin/coaches/${c.id}`} className="text-sm text-secondary underline">
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
            basePath="/admin/coaches"
            searchParams={{ q }}
          />
        </>
      )}
    </>
  );
}
