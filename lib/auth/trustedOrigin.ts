import { safeInternalPath } from "@/lib/auth/safePath";
import { configuredAppOrigin } from "@/lib/notifications/emailDelivery";

function validOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/** Prefer configured public app URL; do not rely solely on request headers. */
export function trustedAppOrigin(): string | null {
  return (
    validOrigin(configuredAppOrigin()) ||
    validOrigin(process.env.NEXT_PUBLIC_BASE_URL?.trim()) ||
    null
  );
}

/** Auth callback URL that requires a configured trusted origin. */
export function trustedAuthCallbackUrl(nextPath: string): string | null {
  const origin = trustedAppOrigin();
  if (!origin) return null;
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", safeInternalPath(nextPath));
  return url.toString();
}
