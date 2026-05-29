"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

type ListingPaginationProps = {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  buildHref: (page: number) => string;
  /** e.g. "venues" or "coaches" */
  itemLabel?: string;
};

function pageWindow(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  return [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
}

export default function ListingPagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  buildHref,
  itemLabel = "results",
}: ListingPaginationProps) {
  if (totalCount <= pageSize) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);
  const pages = pageWindow(page, totalPages);

  const navBtn =
    "inline-flex h-10 items-center justify-center gap-1 rounded-xl border border-primary/15 bg-white px-4 text-sm font-semibold text-primary shadow-sm transition hover:border-primary/25 hover:bg-surface disabled:pointer-events-none disabled:opacity-45";

  return (
    <nav
      className="mt-10 flex flex-col items-center gap-4 border-t border-primary/10 pt-8"
      aria-label="Pagination"
    >
      <p className="text-sm text-primary/70">
        Showing <span className="font-semibold text-primary">{from}</span>–
        <span className="font-semibold text-primary">{to}</span> of{" "}
        <span className="font-semibold text-primary">{totalCount}</span> {itemLabel}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {page > 1 ? (
          <Link href={buildHref(page - 1)} className={navBtn} scroll>
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Previous
          </Link>
        ) : (
          <span className={navBtn} aria-disabled>
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Previous
          </span>
        )}

        <ol className="flex items-center gap-1">
          {pages.map((p, i) => {
            const prev = pages[i - 1];
            const gap = prev != null && p - prev > 1;
            return (
              <li key={p} className="flex items-center gap-1">
                {gap ? <span className="px-1 text-primary/40">…</span> : null}
                {p === page ? (
                  <span
                    className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-primary px-3 text-sm font-bold text-white"
                    aria-current="page"
                  >
                    {p}
                  </span>
                ) : (
                  <Link
                    href={buildHref(p)}
                    scroll
                    className="flex h-10 min-w-10 items-center justify-center rounded-xl border border-primary/15 bg-white px-3 text-sm font-semibold text-primary transition hover:border-primary/25 hover:bg-surface"
                  >
                    {p}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>

        {page < totalPages ? (
          <Link href={buildHref(page + 1)} className={navBtn} scroll>
            Next
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        ) : (
          <span className={navBtn} aria-disabled>
            Next
            <ChevronRight className="h-4 w-4" aria-hidden />
          </span>
        )}
      </div>
    </nav>
  );
}
