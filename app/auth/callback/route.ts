import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { applyPasswordRecoveryCookie } from "@/lib/auth/recovery";
import { passwordRecoveryDestination } from "@/lib/auth/recoverySession";
import { safeInternalPath } from "@/lib/auth/redirects";
import { maybeSendRegistrationAdminNotification, registrationIntentLabel } from "@/lib/notifications/registrationAdminEmail";

function copyResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

function createCallbackClient(request: NextRequest, response: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
  }

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });
}

export async function GET(request: NextRequest) {
  const requestUrl = request.nextUrl;
  const code = requestUrl.searchParams.get("code");
  const nextPath = safeInternalPath(requestUrl.searchParams.get("next"));
  const isRecovery = nextPath === "/reset-password" || requestUrl.searchParams.get("type") === "recovery";
  const failurePath = (reason: "missing_code" | "invalid_code") =>
    isRecovery ? "/forgot-password?error=invalid" : `/login?error=${reason}`;

  if (!code) {
    return NextResponse.redirect(new URL(failurePath("missing_code"), requestUrl.origin));
  }

  const pending = NextResponse.redirect(new URL(nextPath, requestUrl.origin));
  const supabase = createCallbackClient(request, pending);
  let exchangeFailed = false;
  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    exchangeFailed = Boolean(error);
  } catch (error) {
    if (!isRecovery) throw error;
    exchangeFailed = true;
  }

  if (exchangeFailed) {
    return copyResponseCookies(
      pending,
      NextResponse.redirect(new URL(failurePath("invalid_code"), requestUrl.origin))
    );
  }

  const { data: claimsData } = await supabase.auth.getClaims();
  const destination = passwordRecoveryDestination({
    nextPath,
    amr: claimsData?.claims?.amr,
  });

  const response = copyResponseCookies(
    pending,
    NextResponse.redirect(new URL(destination, requestUrl.origin))
  );

  if (destination === "/reset-password") {
    applyPasswordRecoveryCookie(response);
  } else {
    try {
      await maybeSendRegistrationAdminNotification({
        isRecovery,
        nextPath: destination,
        claim: async () => {
          const { data, error } = await supabase.rpc(
            "claim_registration_admin_notification"
          );
          if (error) return false;
          return data === true;
        },
        loadAccount: async () => {
          const { data } = await supabase.auth.getUser();
          const user = data.user;
          if (!user?.email) return null;
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .maybeSingle();
          const metadata = user.user_metadata ?? {};
          const metadataName =
            typeof metadata.full_name === "string" ? metadata.full_name : "";
          const confirmedAt = user.email_confirmed_at
            ? new Date(user.email_confirmed_at).toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : null;
          return {
            name: profile?.full_name?.trim() || metadataName.trim() || "Not provided",
            email: user.email,
            intent: registrationIntentLabel(metadata.signup_intent),
            confirmedAt,
          };
        },
      });
    } catch {
      console.warn("[registration-email] notification skipped after an unexpected error");
    }
  }

  return response;
}
