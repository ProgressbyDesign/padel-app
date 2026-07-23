import { NextResponse } from "next/server";
import { markPasswordRecoverySession } from "@/lib/auth/recovery";
import { safeInternalPath } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = safeInternalPath(requestUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", requestUrl.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=invalid_code", requestUrl.origin));
  }

  if (nextPath === "/reset-password") {
    await markPasswordRecoverySession();
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
