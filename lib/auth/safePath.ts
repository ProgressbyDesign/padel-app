/**
 * Allow only same-origin application paths for post-auth redirects.
 * Rejects absolute URLs, protocol-relative URLs, schemes, and control chars.
 * Safe for client and server imports.
 */
export function safeInternalPath(
  value: string | null | undefined,
  fallback = "/account"
): string {
  const raw = value?.trim();
  if (!raw) return fallback;

  let candidate = raw;
  try {
    candidate = decodeURIComponent(raw);
  } catch {
    return fallback;
  }
  candidate = candidate.trim();

  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\r\n\0]/.test(candidate) ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate) ||
    /(?:^|\/)javascript:/i.test(candidate) ||
    /https?:/i.test(candidate) ||
    /data:/i.test(candidate)
  ) {
    return fallback;
  }

  return candidate;
}
