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

  // Preserve the existing admin guard while migrating from middleware to proxy.
  if (!pathname.startsWith("/admin") || pathname === "/admin/login") {
    return response;
  }

  const secret = process.env.ADMIN_SECRET?.trim();
  if (!secret) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("error", "config");
    return copyResponseCookies(response, NextResponse.redirect(url));
  }

  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (token !== secret) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
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
