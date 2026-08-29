import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { rawCoachRowToProfileView } from "./coachProfileView";
import { mapPublicVenueRow } from "./queries/mapPublicVenue";
import { clampPage, listingPageCount } from "./listingUrlParams";
import {
  PUBLIC_COACH_COLUMNS,
  PUBLIC_COACH_PRIVATE_COLUMNS,
  PUBLIC_COACH_SELECT,
  PUBLIC_VENUE_COLUMNS,
  PUBLIC_VENUE_PRIVATE_COLUMNS,
  PUBLIC_VENUE_SELECT,
} from "./publicProfiles";

const ROOT = path.resolve(__dirname, "..");

function read(relativePath: string) {
  return readFileSync(path.join(ROOT, relativePath), "utf8").replace(/\r\n/g, "\n");
}

describe("public profile projections", () => {
  const migrationA = read(
    "supabase/migrations/20260828010000_sprint6a4_public_profile_projections.sql"
  );

  it("creates explicit allow-list views without SELECT *", () => {
    expect(migrationA).toContain("create view public.coach_public_profiles");
    expect(migrationA).toContain("create view public.venue_public_profiles");
    expect(migrationA).toContain("security_barrier = true");
    expect(migrationA.replace(/--.*$/gm, "")).not.toMatch(/select\s+\*/i);
    expect(migrationA).toContain("where coaches.publication_status = 'published'");
    expect(migrationA).toContain("where venues.publication_status = 'published'");
  });

  it("grants SELECT only on the public views", () => {
    expect(migrationA).toContain(
      "revoke all on table public.coach_public_profiles from public, anon, authenticated"
    );
    expect(migrationA).toContain(
      "revoke all on table public.venue_public_profiles from public, anon, authenticated"
    );
    expect(migrationA).toContain(
      "grant select on table public.coach_public_profiles to anon, authenticated"
    );
    expect(migrationA).toContain(
      "grant select on table public.venue_public_profiles to anon, authenticated"
    );
    expect(migrationA).not.toMatch(/grant insert/i);
    expect(migrationA).not.toMatch(/grant update/i);
  });

  it("adds authenticated relationship identities without contact columns", () => {
    expect(migrationA).toContain("create view public.coach_relationship_identities");
    expect(migrationA).toContain("create view public.venue_relationship_identities");
    expect(migrationA).toContain(
      "grant select on table public.coach_relationship_identities to authenticated"
    );
    expect(migrationA).toContain(
      "grant select on table public.venue_relationship_identities to authenticated"
    );
    expect(migrationA).toContain(
      "revoke all on table public.coach_relationship_identities from public, anon, authenticated"
    );
    expect(migrationA).toContain(
      "revoke all on table public.venue_relationship_identities from public, anon, authenticated"
    );
    expect(migrationA).not.toMatch(
      /grant select on table public\.coach_relationship_identities to anon/i
    );
    expect(migrationA).not.toContain("coaches.email");
    expect(migrationA).not.toContain("coaches.phone");
    expect(migrationA).not.toContain("venues.phone");
    expect(migrationA).not.toContain("venues.website");
  });

  it("scopes relationship identities to the caller membership via auth.uid()", () => {
    const stripped = migrationA.replace(/--.*$/gm, "");
    expect(stripped).toMatch(
      /create view public\.coach_relationship_identities[\s\S]*join public\.venue_memberships membership[\s\S]*membership\.user_id = \(select auth\.uid\(\)\)/
    );
    expect(stripped).toMatch(
      /create view public\.venue_relationship_identities[\s\S]*join public\.coach_memberships membership[\s\S]*membership\.user_id = \(select auth\.uid\(\)\)/
    );
    expect(stripped).not.toMatch(
      /create view public\.coach_relationship_identities[\s\S]*security_invoker\s*=\s*true/
    );
    const uidMatches = stripped.match(/membership\.user_id = \(select auth\.uid\(\)\)/g) ?? [];
    expect(uidMatches.length).toBe(2);
  });

  it("limits relationship identities to workspace-current coach_venues statuses", () => {
    const stripped = migrationA.replace(/--.*$/gm, "");
    expect(stripped).toContain(
      "link.status in ('unverified', 'pending', 'active')"
    );
    const statusMatches =
      stripped.match(/link\.status in \('unverified', 'pending', 'active'\)/g) ??
      [];
    expect(statusMatches.length).toBe(2);
    const harness = read("supabase/tests/sprint6a4_disposable_harness.sql");
    expect(harness).toContain(
      "link.status in ('unverified', 'pending', 'active')"
    );
  });

  it("omits partner contact and audit columns from the views", () => {
    for (const column of PUBLIC_COACH_PRIVATE_COLUMNS) {
      expect(migrationA).not.toContain(`coaches.${column}`);
    }
    for (const column of PUBLIC_VENUE_PRIVATE_COLUMNS) {
      expect(migrationA).not.toContain(`venues.${column}`);
    }
    expect(PUBLIC_COACH_COLUMNS).not.toContain("email");
    expect(PUBLIC_COACH_COLUMNS).not.toContain("phone");
    expect(PUBLIC_VENUE_COLUMNS).not.toContain("phone");
    expect(PUBLIC_VENUE_COLUMNS).not.toContain("website");
  });
});

describe("migration B lockdown", () => {
  const migrationB = read(
    "supabase/migrations/20260828020000_sprint6a4_lock_public_profile_base_access.sql"
  );

  it("revokes anon base-table and social reads without deleting contact data", () => {
    expect(migrationB).toContain("revoke select on table public.coaches from anon");
    expect(migrationB).toContain("revoke select on table public.venues from anon");
    expect(migrationB).toContain(
      'drop policy if exists "Anonymous can read published coaches"'
    );
    expect(migrationB).toContain(
      'drop policy if exists "Anonymous can read published venues"'
    );
    expect(migrationB).toContain("revoke select on table public.coach_socials from anon");
    expect(migrationB).toContain("revoke select on table public.venue_socials from anon");
    expect(migrationB).not.toMatch(/delete from public\.coaches/i);
    expect(migrationB).not.toMatch(/update public\.coaches set email/i);
    expect(migrationB).not.toMatch(
      /publication_status = 'published'\s*\n\s*or exists/i
    );
  });

  it("does not grant linked partners the opposite full base row", () => {
    expect(migrationB).not.toContain("from public.coach_venues link");
    expect(migrationB).not.toContain("Partner workspace exception");
    expect(migrationB).toContain("There is no linked-partner full-base-row access");
    const coachesPolicy = migrationB.slice(
      migrationB.indexOf('create policy "Authenticated can read permitted coaches"'),
      migrationB.indexOf('create policy "Authenticated can read permitted venues"')
    );
    const venuesPolicy = migrationB.slice(
      migrationB.indexOf('create policy "Authenticated can read permitted venues"'),
      migrationB.indexOf("-- ---------------------------------------------------------------------------\n-- 3.")
    );
    expect(coachesPolicy).toContain("coach_memberships");
    expect(coachesPolicy).toContain("profiles.read");
    expect(coachesPolicy).not.toContain("venue_memberships");
    expect(coachesPolicy).not.toContain("coach_venues");
    expect(venuesPolicy).toContain("venue_memberships");
    expect(venuesPolicy).toContain("profiles.read");
    expect(venuesPolicy).not.toContain("coach_memberships");
    expect(venuesPolicy).not.toContain("coach_venues");
  });

  it("disposable harness matches the locked membership-only policies", () => {
    const harness = read("supabase/tests/sprint6a4_disposable_harness.sql");
    expect(harness).toContain("create view public.coach_relationship_identities");
    const migrationB = harness.slice(harness.indexOf("-- Migration B"));
    expect(migrationB).not.toContain("from public.coach_venues link");
    expect(migrationB).toContain("or private.has_admin_permission('profiles.read')");
  });
});

describe("public coach profile mapping", () => {
  it("does not copy email, phone, or socials onto the public view", () => {
    const view = rawCoachRowToProfileView({
      id: "coach-1",
      name: "Ana",
      description: "A generous public coaching description for padel players.",
      is_approved: true,
      email: "hidden@example.com",
      phone: "+34111",
    } as never);
    expect(view).not.toHaveProperty("contact");
    expect(view.socials).toEqual([]);
    expect(JSON.stringify(view)).not.toContain("hidden@example.com");
    expect(JSON.stringify(view)).not.toContain("+34111");
  });
});

describe("public venue mapping", () => {
  it("does not copy phone, website, or socials", () => {
    const mapped = mapPublicVenueRow({
      id: "venue-1",
      name: "Club",
      city: "Valencia",
      country: "Spain",
      lat: 39.4,
      lng: -0.3,
      rating: 5,
      review_count: 3,
      image_url: null,
      courts: 4,
      court_type: "indoor",
      coaching_available: true,
      price: null,
      coaching_description: "Coaching available.",
      venue_type: null,
      opening_hours: "9-21",
      opening_hours_structured: null,
      address: "1 Test Street",
      images: null,
      is_approved: true,
      search_key: "club valencia",
      publication_status: "published",
    });
    expect(mapped).not.toHaveProperty("phone");
    expect(mapped).not.toHaveProperty("website");
    expect(mapped).not.toHaveProperty("venue_socials");
    expect(mapped).not.toHaveProperty("google_place_id");
    expect(mapped.address).toBe("1 Test Street");
  });
});

describe("listing pagination helpers", () => {
  it("paginates and clamps pages", () => {
    expect(listingPageCount(0, 50)).toBe(1);
    expect(listingPageCount(50, 50)).toBe(1);
    expect(listingPageCount(51, 50)).toBe(2);
    expect(clampPage(0, 3)).toBe(1);
    expect(clampPage(9, 3)).toBe(3);
  });
});

describe("public query audit", () => {
  const publicModules = [
    "lib/fetchCoachPdp.ts",
    "lib/queries/coachListingQuery.ts",
    "lib/queries/venueListingQuery.ts",
    "lib/queries/topRatedHome.ts",
    "lib/queries/searchSuggestions.ts",
    "lib/queries/coachRows.ts",
    "lib/queries/padelCountries.ts",
    "lib/queries/locationOptions.ts",
    "lib/queries/publicCoachVenues.ts",
    "lib/queries/hydratePublicCoaches.ts",
    "lib/queries/mapPublicVenue.ts",
    "app/page.tsx",
    "app/coach/[id]/page.tsx",
    "app/venue/[id]/page.tsx",
    "app/actions/enquiries.ts",
    "app/api/stats/counts/route.ts",
    "app/api/coaches/top-rated/route.ts",
    "app/api/search/suggestions/route.ts",
  ];

  it("does not read base coaches/venues tables from public loaders", () => {
    for (const relativePath of publicModules) {
      const source = read(relativePath);
      expect(source, relativePath).not.toMatch(/\.from\(\s*["']coaches["']\s*\)/);
      expect(source, relativePath).not.toMatch(/\.from\(\s*["']venues["']\s*\)/);
    }
  });

  it("does not use select(\"*\") against public profile views", () => {
    for (const relativePath of publicModules) {
      const source = read(relativePath);
      expect(source, relativePath).not.toMatch(
        /from\((COACH_PUBLIC_PROFILES_TABLE|VENUE_PUBLIC_PROFILES_TABLE)\)\s*\n\s*\.select\(\s*["']\*["']/
      );
    }
    expect(PUBLIC_COACH_SELECT).not.toContain("*");
    expect(PUBLIC_VENUE_SELECT).not.toContain("*");
  });

  it("does not select email or phone in public coach loaders", () => {
    const pdp = read("lib/fetchCoachPdp.ts");
    expect(pdp).toContain("COACH_PUBLIC_PROFILES_TABLE");
    expect(pdp).toContain("PUBLIC_COACH_SELECT");
    expect(pdp).not.toMatch(/select\([\s\S]*email/);
    expect(pdp).not.toMatch(/select\([\s\S]*phone/);
    expect(pdp).not.toContain('select("*")');
    expect(pdp).not.toContain(".from(\"coaches\")");

    const hydrate = read("lib/queries/hydratePublicCoaches.ts");
    expect(hydrate).not.toContain("coach_socials");
    expect(hydrate).not.toContain("email");
    expect(hydrate).not.toContain("phone");
  });
});

describe("public listings still search, filter, paginate, and sort", () => {
  it("keeps coach listing search, filters, pagination, and sorting", () => {
    const source = read("lib/queries/coachListingQuery.ts");
    expect(source).toContain("COACH_PUBLIC_PROFILES_TABLE");
    expect(source).toContain("PUBLIC_COACH_SELECT");
    expect(source).toContain("listingPageCount");
    expect(source).toContain("clampPage");
    expect(source).toContain("sortCoachListing");
    expect(source).toContain("travelOnly");
    expect(source).toContain("audienceAdults");
    expect(source).toContain("audienceJuniors");
    expect(source).toContain("coachIdsMatchingOutcomeSearch");
    expect(source).not.toContain(".from(\"coaches\")");
  });

  it("keeps venue listing search, filters, distance sort, and pagination", () => {
    const source = read("lib/queries/venueListingQuery.ts");
    expect(source).toContain("VENUE_PUBLIC_PROFILES_TABLE");
    expect(source).toContain("PUBLIC_VENUE_SELECT");
    expect(source).toContain("listingPageCount");
    expect(source).toContain("useDistanceSort");
    expect(source).toContain("applyVenueLocationFilter");
    expect(source).toContain("applyVenueNameFilter");
    expect(source).not.toContain(".from(\"venues\")");
    expect(source).not.toContain('select("*")');
  });
});

describe("managed and admin workspaces retain private contact", () => {
  it("coach workspace still reads email, phone, and socials from the base table", () => {
    const source = read("lib/queries/managedCoach.ts");
    expect(source).toContain('.from("coaches")');
    expect(source).toContain("email");
    expect(source).toContain("phone");
    expect(source).toContain("coach_socials");
  });

  it("venue workspace still reads phone, website, and socials from the base table", () => {
    const source = read("lib/queries/managedVenue.ts");
    expect(source).toContain('.from("venues")');
    expect(source).toContain("phone");
    expect(source).toContain("website");
    expect(source).toContain("loadVenueSocials");
  });

  it("admin directory still uses base coaches/venues including contact fields", () => {
    const source = read("lib/admin/queries.ts");
    expect(source).toContain('.from("coaches")');
    expect(source).toContain('.from("venues")');
    expect(source).toContain("email");
    expect(source).toContain("phone");
    expect(source).toContain("website");
  });
});

describe("player booking payloads stay on the public projection", () => {
  it("does not embed coaches.email/phone for player booking reads", () => {
    const source = read("lib/queries/coachBookings.ts");
    expect(source).toContain("BOOKING_CORE_SELECT");
    expect(source).toContain("attachPublicBookingParties");
    expect(source).toContain("COACH_PUBLIC_PROFILES_TABLE");
    expect(source).toContain("email: null");
    expect(source).toContain("phone: null");
    expect(source).toContain("loadPlayerBookings");
    expect(source).toContain("BOOKING_COACH_MANAGER_SELECT");
    expect(source).toContain("attachWorkspaceVenueParties");
    expect(source).toContain("loadVenueRelationshipIdentities");
  });

  it("player booking detail never overlays coach contact even if base RLS would allow it", () => {
    const source = read("lib/queries/coachBookings.ts");
    const playerLoader = source.slice(
      source.indexOf("export async function loadBookingById"),
      source.indexOf("export async function loadManagedCoachBookingById")
    );
    expect(playerLoader).toContain("attachPublicBookingParties");
    expect(playerLoader).not.toContain("overlayManagedCoachContact");
    expect(playerLoader).not.toMatch(/\.from\(\s*["']coaches["']\s*\)/);
    expect(playerLoader).not.toContain("email, phone");

    const managedLoader = source.slice(
      source.indexOf("export async function loadManagedCoachBookingById"),
      source.indexOf("export async function loadPlayerBookings")
    );
    expect(managedLoader).toContain("callerManagesCoach");
    expect(managedLoader).toContain("overlayManagedCoachContact");
    expect(source).toContain('.from("coach_memberships")');

    const page = read("app/account/bookings/[bookingId]/page.tsx");
    expect(page).toContain("loadBookingById");
    expect(page).not.toContain("loadManagedCoachBookingById");

    const actions = read("app/account/bookings/actions.ts");
    expect(actions).toContain("loadBookingById");
    expect(actions).toContain("resolveCoachNotificationEmail");
    expect(actions).not.toContain("loadManagedCoachBookingById");
    expect(actions).not.toMatch(/booking\.coach\?\.email/);
    expect(actions).not.toMatch(/updated\.coach\?\.email/);

    const detail = read("components/bookings/PlayerBookingDetail.tsx");
    expect(detail).not.toContain("mailto:");
    expect(detail).not.toContain("tel:");
    expect(detail).not.toContain("Coach contact");
  });
});

describe("public UI source", () => {
  it("coach PDP has no mailto/tel/email/phone contact block and keeps the enquiry CTA", () => {
    const source = read("components/CoachProfilePage.tsx");
    expect(source).not.toContain("mailto:");
    expect(source).not.toContain("tel:");
    expect(source).not.toContain("coach.contact");
    expect(source).toContain("Send a coaching enquiry");
    expect(source).toContain("EnquiryButton");
  });

  it("venue PDP keeps address/hours/map and enquiry, without phone/website/socials", () => {
    const detail = read("components/VenueDetailPage.tsx");
    const info = read("components/venue-detail/VenueInfoSection.tsx");
    expect(detail).toContain("VenueInfoSection");
    expect(detail).toContain("VenueMapSection");
    expect(detail).toContain("Send venue enquiry");
    expect(detail).not.toContain("VenueContactSection");
    expect(info).toContain("address");
    expect(info).toContain("Opening hours");
    expect(info).not.toContain("tel:");
    expect(info).not.toContain("website");
    expect(info).not.toContain("Social links");
  });
});

describe("relationship workspaces do not read the opposite base row", () => {
  const relationshipModules = [
    "lib/queries/coachVenueRelationships.ts",
    "lib/queries/venueOperations.ts",
    "lib/queries/coachAvailability.ts",
    "lib/queries/venueBookingBlocks.ts",
    "lib/queries/managedCoachShell.ts",
    "lib/queries/relationshipIdentities.ts",
    "app/account/coaches/[coachId]/venue-actions.ts",
    "app/account/venues/[venueId]/coach-actions.ts",
  ];

  it("hydrates linked-partner identity from public or relationship views", () => {
    const identities = read("lib/queries/relationshipIdentities.ts");
    expect(identities).toContain("COACH_PUBLIC_PROFILES_TABLE");
    expect(identities).toContain("VENUE_PUBLIC_PROFILES_TABLE");
    expect(identities).toContain("coach_relationship_identities");
    expect(identities).toContain("venue_relationship_identities");
    expect(identities).not.toMatch(/\.from\(\s*["']coaches["']\s*\)/);
    expect(identities).not.toMatch(/\.from\(\s*["']venues["']\s*\)/);
  });

  it("does not embed opposite-party email, phone, or website", () => {
    for (const relativePath of relationshipModules) {
      const source = read(relativePath);
      expect(source, relativePath).not.toMatch(
        /coaches\s*\(\s*[^)]*email/i
      );
      expect(source, relativePath).not.toMatch(
        /venues\s*\(\s*[^)]*website/i
      );
    }
    const relationships = read("lib/queries/coachVenueRelationships.ts");
    expect(relationships).toContain("RELATIONSHIP_CORE_SELECT");
    expect(relationships).toContain("loadVenueRelationshipIdentities");
    expect(relationships).toContain("loadCoachRelationshipIdentities");
    expect(relationships).not.toMatch(/venues\s*\(/);
    expect(relationships).not.toMatch(/coaches\s*\(/);

    const venueOps = read("lib/queries/venueOperations.ts");
    expect(venueOps).not.toContain("coachEmail");
    expect(venueOps).toContain("loadCoachRelationshipIdentities");

    const manager = read("components/account/VenueCoachesManager.tsx");
    expect(manager).not.toContain("mailto:");
    expect(manager).toContain("configure availability in their workspace");
  });
});
