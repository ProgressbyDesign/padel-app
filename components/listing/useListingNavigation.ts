"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useScrollToTopOnPageChange(page: number) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);
}

/** Push updated query string; resets page to 1 unless `nextPage` provided. */
export function useListingNavigation(basePath: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pushQuery = useCallback(
    (mutate: (q: URLSearchParams) => URLSearchParams | void, opts?: { page?: number }) => {
      const base = new URLSearchParams(searchParams.toString());
      const result = mutate(base);
      const q = result instanceof URLSearchParams ? result : base;
      const page = opts?.page ?? 1;
      if (page <= 1) q.delete("page");
      else q.set("page", String(page));
      const path = pathname.startsWith(basePath) ? pathname : basePath;
      const qs = q.toString();
      router.push(qs ? `${path}?${qs}` : path, { scroll: false });
    },
    [router, pathname, searchParams, basePath]
  );

  return { pushQuery, searchParams };
}
