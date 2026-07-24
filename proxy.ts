import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin/auth";
import { updateSession } from "@/lib/supabase/proxy";

function copyResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

export async function proxy(request: NextRequest) {
  const response = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Legacy shared-secret tools live under /admin/data-quality.
  if (pathname === "/admin/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/data-quality/login";
    return copyResponseCookies(response, NextResponse.redirect(url));
  }

  const legacyPaths = [
    "/admin/review-queue",
    "/admin/venues",
    "/admin/coaches",
    "/admin/coach-venue-links",
  ];
  for (const legacy of legacyPaths) {
    if (pathname === legacy || pathname.startsWith(`${legacy}/`)) {
      const url = request.nextUrl.clone();
      url.pathname = pathname.replace("/admin", "/admin/data-quality");
      return copyResponseCookies(response, NextResponse.redirect(url));
    }
  }

  const isDataQuality =
    pathname.startsWith("/admin/data-quality") &&
    pathname !== "/admin/data-quality/login";

  if (!isDataQuality) {
    return response;
  }

  const secret = process.env.ADMIN_SECRET?.trim();
  if (!secret) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/data-quality/login";
    url.searchParams.set("error", "config");
    return copyResponseCookies(response, NextResponse.redirect(url));
  }

  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (token !== secret) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/data-quality/login";
    url.searchParams.set("next", pathname);
    return copyResponseCookies(response, NextResponse.redirect(url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
