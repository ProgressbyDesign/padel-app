/** Presentation hint only. Memberships and application approval control access. */
export function signupIntent(nextPath: string): "coach" | "venue" | "player" {
  const path = nextPath.split(/[?#]/)[0];
  if (path === "/account/applications/coach") return "coach";
  if (path === "/account/applications/venue") return "venue";
  return "player";
}
