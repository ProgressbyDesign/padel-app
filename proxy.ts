import { NextResponse, type NextRequest } from "next/server";
import { redirectedAdminPath } from "@/lib/admin/legacyAdminRedirect";
import { updateSession } from "@/lib/supabase/proxy";

function copyResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

export async function proxy(request: NextRequest) {
  const response = await updateSession(request);
  const { pathname } = request.nextUrl;

  const redirected = redirectedAdminPath(pathname);
  if (redirected) {
    const url = request.nextUrl.clone();
    url.pathname = redirected;
    if (pathname === "/admin/login") {
      url.search = "";
      url.searchParams.set("next", "/admin");
    }
    return copyResponseCookies(response, NextResponse.redirect(url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
