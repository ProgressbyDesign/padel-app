import Image from "next/image";
import Link from "next/link";
import {
  AdminEmpty,
  AdminPageHeader,
  AdminTable,
  AdminTd,
  AdminTh,
  PaginationBar,
  qualityBadge,
} from "@/components/admin/ui";
import { fetchReviewQueue } from "@/lib/admin/queries";
import type { ReviewQueueFilter } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

const FILTERS: { id: ReviewQueueFilter; label: string }[] = [
  { id: "coaches_without_venue", label: "Coaches without venue" },
  { id: "coaches_without_image", label: "Coaches without image" },
  { id: "coaches_low_confidence", label: "Coaches pending review" },
  { id: "venues_without_socials", label: "Venues without socials" },
  { id: "venues_needing_review", label: "Venues needing review" },
  { id: "approved", label: "Approved content" },
];

type Props = { searchParams: Promise<{ filter?: string; page?: string }> };

export default async function AdminReviewQueuePage({ searchParams }: Props) {
  const sp = await searchParams;
  const filter = (FILTERS.some((f) => f.id === sp.filter) ? sp.filter : "coaches_without_venue") as ReviewQueueFilter;
  const page = Math.max(1, Number(sp.page) || 1);

  let coaches: Awaited<ReturnType<typeof fetchReviewQueue>>["coaches"] = [];
  let venues: Awaited<ReturnType<typeof fetchReviewQueue>>["venues"] = [];
  let total = 0;
  let error: string | null = null;

  try {
    const res = await fetchReviewQueue(filter, page);
    coaches = res.coaches;
    venues = res.venues;
    total = res.total;
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load queue";
  }

  return (
    <>
      <AdminPageHeader title="Review queue" description="Grouped filters for common data quality issues." />
      <nav className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={`/admin/review-queue?filter=${f.id}`}
            className={`rounded-full px-3 py-1 text-sm ${
              filter === f.id
                ? "bg-primary text-white"
                : "border border-primary/15 bg-white text-primary hover:bg-surface"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {coaches.length > 0 ? (
        <>
          <h2 className="mb-2 text-lg font-semibold text-primary">Coaches</h2>
          <AdminTable>
            <thead>
              <tr>
                <AdminTh>Image</AdminTh>
                <AdminTh>Name</AdminTh>
                <AdminTh>Status</AdminTh>
                <AdminTh />
              </tr>
            </thead>
            <tbody>
              {coaches.map((c) => (
                <tr key={c.id}>
                  <AdminTd>
                    {c.image_url ? (
                      <div className="relative h-10 w-10 overflow-hidden rounded">
                        <Image src={c.image_url} alt="" fill className="object-cover" unoptimized />
                      </div>
                    ) : (
                      "—"
                    )}
                  </AdminTd>
                  <AdminTd>{c.name ?? "—"}</AdminTd>
                  <AdminTd>{qualityBadge(c.data_quality_status, c.is_approved)}</AdminTd>
                  <AdminTd>
                    <Link href={`/admin/coaches/${c.id}`} className="text-secondary underline">
                      Edit
                    </Link>
                    {filter === "coaches_without_venue" ? (
                      <>
                        {" · "}
                        <Link href="/admin/coach-venue-links" className="text-secondary underline">
                          Link venues
                        </Link>
                      </>
                    ) : null}
                  </AdminTd>
                </tr>
              ))}
            </tbody>
          </AdminTable>
        </>
      ) : null}

      {venues.length > 0 ? (
        <>
          <h2 className="mb-2 mt-8 text-lg font-semibold text-primary">Venues</h2>
          <AdminTable>
            <thead>
              <tr>
                <AdminTh>Name</AdminTh>
                <AdminTh>Location</AdminTh>
                <AdminTh>Status</AdminTh>
                <AdminTh />
              </tr>
            </thead>
            <tbody>
              {venues.map((v) => (
                <tr key={v.id}>
                  <AdminTd>{v.name ?? "—"}</AdminTd>
                  <AdminTd>{[v.city, v.country].filter(Boolean).join(", ") || "—"}</AdminTd>
                  <AdminTd>{qualityBadge(v.data_quality_status, v.is_approved)}</AdminTd>
                  <AdminTd>
                    <Link href={`/admin/venues/${v.id}`} className="text-secondary underline">
                      Edit
                    </Link>
                  </AdminTd>
                </tr>
              ))}
            </tbody>
          </AdminTable>
        </>
      ) : null}

      {coaches.length === 0 && venues.length === 0 && !error ? (
        <AdminEmpty message="Nothing in this queue." />
      ) : null}

      <PaginationBar
        page={page}
        total={total}
        pageSize={25}
        basePath="/admin/review-queue"
        searchParams={{ filter }}
      />
    </>
  );
}
