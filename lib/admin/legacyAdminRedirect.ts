/**
 * Bookmark-compatible redirects for old crawler-tool URLs.
 * Operational /admin/coaches and /admin/venues are not redirected.
 */
export function redirectedAdminPath(pathname: string): string | null {
  if (pathname === "/admin/login") {
    return "/login";
  }
  if (pathname === "/admin/data-quality/login") {
    return "/admin/data-quality";
  }
  if (
    pathname === "/admin/review-queue" ||
    pathname.startsWith("/admin/review-queue/") ||
    pathname === "/admin/coach-venue-links" ||
    pathname.startsWith("/admin/coach-venue-links/")
  ) {
    return pathname.replace(/^\/admin/, "/admin/data-quality");
  }
  return null;
}
