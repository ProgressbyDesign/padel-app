import { headers } from "next/headers";
import { safeInternalPath } from "@/lib/auth/safePath";

export { safeInternalPath };

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

export async function getRequestOrigin(): Promise<string> {
  const configured = validOrigin(process.env.NEXT_PUBLIC_BASE_URL?.trim());
  if (configured) return configured;

  const requestHeaders = await headers();
  const requestOrigin = validOrigin(requestHeaders.get("origin"));
  if (requestOrigin) return requestOrigin;

  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost ?? requestHeaders.get("host");
  if (host) {
    const protocol =
      requestHeaders.get("x-forwarded-proto") ??
      (host.startsWith("localhost") ? "http" : "https");
    const forwardedOrigin = validOrigin(`${protocol}://${host}`);
    if (forwardedOrigin) return forwardedOrigin;
  }

  return "http://localhost:3000";
}

export async function authCallbackUrl(nextPath: string): Promise<string> {
  const origin = await getRequestOrigin();
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", safeInternalPath(nextPath));
  return url.toString();
}
