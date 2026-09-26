/**
 * GoTrue Site URL fallback lands leftover PKCE codes on `/` only.
 * Other routes may use `?code=` for their own features and must not be intercepted.
 */
export function shouldForwardStrandedAuthCode(pathname: string): boolean {
  return pathname === "/";
}

/**
 * Returns the callback path (preserving existing query, including `code` and
 * `next`) when this request is the Site URL fallback. Otherwise null.
 */
export function strandedAuthCallbackPath(
  pathname: string,
  search: string
): string | null {
  const query = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(query);
  if (!params.get("code") || !shouldForwardStrandedAuthCode(pathname)) {
    return null;
  }
  const suffix = params.toString();
  return suffix ? `/auth/callback?${suffix}` : "/auth/callback";
}
