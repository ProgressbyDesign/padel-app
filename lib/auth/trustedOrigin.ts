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

/** Recovery must fail closed in production instead of trusting headers or a dev URL. */
export function productionRecoveryOrigin(): string {
  const raw = configuredAppOrigin() || process.env.NEXT_PUBLIC_BASE_URL?.trim();
  try {
    const url = new URL(raw || "");
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      url.protocol !== "https:" || url.username || url.password ||
      hostname === "localhost" || hostname.endsWith(".localhost") ||
      hostname.startsWith("127.") || hostname === "[::1]" ||
      hostname === "0.0.0.0" || hostname.startsWith("[::ffff:")
    ) throw new Error("Invalid origin");
    return url.origin;
  } catch {
    throw new Error("Password recovery requires a configured public HTTPS app origin.");
  }
}

/** Auth callback URL that requires a configured trusted origin. */
export function trustedAuthCallbackUrl(nextPath: string): string | null {
  const origin = trustedAppOrigin();
  if (!origin) return null;
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", safeInternalPath(nextPath));
  return url.toString();
}
