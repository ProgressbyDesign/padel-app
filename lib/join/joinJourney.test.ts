import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  COACH_APPLICATION_PATH,
  JOIN_NAV_ITEMS,
  VENUE_APPLICATION_PATH,
  partnerSignupHref,
} from "@/lib/join/nav";
import { isPartnerSignupPath, signupPageCopy } from "@/lib/auth/signupCopy";

const ROOT = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("join navigation destinations", () => {
  it("sends players to /join/player and partners to /join", () => {
    expect(JOIN_NAV_ITEMS).toEqual([
      expect.objectContaining({
        eyebrow: "For Players",
        href: "/join/player",
        description: "Create your free player account",
      }),
      expect.objectContaining({
        eyebrow: "For Coaches & Businesses",
        href: "/join",
        description: "Join as a coach, academy, venue or travel partner",
      }),
    ]);
  });

  it("keeps partner application signup next paths intact", () => {
    expect(partnerSignupHref(COACH_APPLICATION_PATH, false)).toBe(
      `/signup?next=${encodeURIComponent(COACH_APPLICATION_PATH)}`
    );
    expect(partnerSignupHref(VENUE_APPLICATION_PATH, false)).toBe(
      `/signup?next=${encodeURIComponent(VENUE_APPLICATION_PATH)}`
    );
    expect(partnerSignupHref(COACH_APPLICATION_PATH, true)).toBe(
      COACH_APPLICATION_PATH
    );
    expect(isPartnerSignupPath(COACH_APPLICATION_PATH)).toBe(true);
    expect(signupPageCopy(COACH_APPLICATION_PATH).description).toMatch(
      /partner application/i
    );
  });
});

describe("join pages", () => {
  it("renders player-specific benefits and the existing SignupForm", () => {
    const page = read("app/join/player/page.tsx");
    expect(page).toContain("Join Padel Pathways as a Player");
    expect(page).toContain("PlayerJoinLanding");

    const landing = read("components/join/PlayerJoinLanding.tsx");
    expect(landing).toContain("Your padel journey, in one place.");
    expect(landing).toContain("PlayerBenefitsBento");
    expect(landing).toContain("PlayerSignupSection");
    expect(landing).toContain('href="/coaches"');
    expect(landing).toContain("#register");

    const bento = read("components/join/PlayerBenefitsBento.tsx");
    expect(bento).toContain("Find the right coach");
    expect(bento).toContain("Train wherever you play");
    expect(bento).toContain("Your bookings");
    expect(bento).toContain("Your player account");
    expect(bento).toContain("Discover venues");
    expect(bento).toContain("Built around your goals");

    const signup = read("components/join/PlayerSignupSection.tsx");
    expect(signup).toContain("SignupForm");
    expect(signup).toContain('nextPath="/account"');
    expect(signup).toContain("Create my player account");
    expect(signup).toContain("from \"@/components/auth/SignupForm\"");
  });

  it("keeps /signup as an independent compact registration route", () => {
    const signup = read("app/signup/page.tsx");
    expect(signup).toContain("SignupForm");
    expect(signup).toContain("signupPageCopy");
    expect(signup).not.toContain("redirect(\"/join/player\")");
    expect(signup).not.toContain("PlayerJoinLanding");
  });

  it("does not introduce payment UI or fake sponsor logos", () => {
    const files = [
      "app/join/page.tsx",
      "app/join/player/page.tsx",
      "components/join/PlayerJoinLanding.tsx",
      "components/join/PartnerJoinLanding.tsx",
      "components/join/PartnerTypeCards.tsx",
      "components/join/JoinTrustStrip.tsx",
      "components/join/JoinNavMenu.tsx",
      "components/AppHeader.tsx",
    ];
    for (const file of files) {
      const source = read(file);
      expect(source, file).not.toMatch(/stripe|checkout|payment details required|pricing plan/i);
      expect(source, file).not.toMatch(/padel directory|thepadeldirectory/i);
      expect(source, file).not.toMatch(/sponsor logo|official sponsor/i);
    }
    const trust = read("components/join/JoinTrustStrip.tsx");
    expect(trust).toContain("Built with players, coaches and padel professionals");
    expect(trust).not.toContain("<Image");
    expect(trust).not.toContain("<img");
  });
});

describe("header join control", () => {
  it("uses the shared join items in desktop and mobile menus", () => {
    const desktop = read("components/join/JoinNavMenu.tsx");
    expect(desktop).toContain("JOIN_NAV_ITEMS");
    expect(desktop).toContain('aria-haspopup="menu"');
    expect(desktop).toContain("Escape");
    expect(desktop).toContain("data-cta={item.cta}");

    const mobile = read("components/join/JoinMobileSection.tsx");
    expect(mobile).toContain("JOIN_NAV_ITEMS");
    expect(mobile).toContain("{item.eyebrow}");
    expect(mobile).toContain("{item.description}");
  });
});
