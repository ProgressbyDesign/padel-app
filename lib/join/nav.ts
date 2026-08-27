export const JOIN_NAV_ITEMS = [
  {
    id: "player",
    eyebrow: "For Players",
    description: "Create your free player account",
    href: "/join/player",
    cta: "join-nav-player",
  },
  {
    id: "partner",
    eyebrow: "For Coaches & Businesses",
    description: "Join as a coach, academy, venue or travel partner",
    href: "/join",
    cta: "join-nav-partner",
  },
] as const;

export const COACH_APPLICATION_PATH = "/account/applications/coach";
export const VENUE_APPLICATION_PATH = "/account/applications/venue";

export function partnerSignupHref(applicationPath: string, authenticated: boolean) {
  if (authenticated) return applicationPath;
  return `/signup?next=${encodeURIComponent(applicationPath)}`;
}

export function partnerLoginHref(applicationPath: string) {
  return `/login?next=${encodeURIComponent(applicationPath)}`;
}
