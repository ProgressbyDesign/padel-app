import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..", "..");
const MIGRATION = path.join(
  ROOT,
  "supabase/migrations/20260803010000_sprint6a_launch_foundation_publication_security.sql"
);

describe("Sprint 6A authenticated table privilege alignment", () => {
  const source = readFileSync(MIGRATION, "utf8");

  it("adds explicit authenticated DML grants rather than GRANT ALL", () => {
    expect(source).toContain(
      "Authenticated table privileges required for RLS-managed writes"
    );
    expect(
      /grant all on all tables in schema public to authenticated/i.test(source)
    ).toBe(false);
  });

  it("grants the write operations required by existing authenticated journeys", () => {
    const normalized = source.replace(/\r\n/g, "\n");
    const required = [
      "grant update (\n  full_name,\n  avatar_path,\n  avatar_updated_at,\n  last_workspace_type,\n  last_workspace_entity_id\n) on public.profiles to authenticated",
      "grant insert, update on public.coaches to authenticated",
      "grant insert, update on public.venues to authenticated",
      "grant insert, update on public.coach_profile_applications to authenticated",
      "grant insert, update on public.venue_profile_applications to authenticated",
      "grant insert, update on public.coach_application_locations to authenticated",
      "grant insert on public.coach_venues to authenticated",
      "grant update (status, is_primary) on public.coach_venues to authenticated",
      "grant insert, update on public.coach_attributes to authenticated",
      "grant insert, update on public.coach_outcomes to authenticated",
      "grant insert, update on public.coach_achievements to authenticated",
      "grant insert, update on public.coach_images to authenticated",
      "grant insert, update on public.coach_socials to authenticated",
      "grant insert, update on public.venue_images to authenticated",
      "grant insert, update on public.venue_socials to authenticated",
      "grant insert, update on public.coach_memberships to authenticated",
      "grant insert, update on public.venue_memberships to authenticated",
      "grant insert on public.enquiries to authenticated",
      "grant insert on public.enquiries to anon",
    ];
    for (const statement of required) {
      expect(normalized).toContain(statement);
    }
  });

  it("does not grant table-wide UPDATE on profiles or coach_venues", () => {
    expect(source).not.toMatch(
      /^grant update on public\.profiles to authenticated;/m
    );
    expect(source).not.toMatch(
      /grant insert, update on public\.coach_venues to authenticated/i
    );
    expect(source).not.toContain(
      "has_table_privilege('authenticated', 'public.profiles', 'UPDATE')"
    );
    expect(source).not.toContain(
      "has_table_privilege('authenticated', 'public.coach_venues', 'UPDATE')"
    );
  });

  it("protects server-owned listing metadata with a non-lifecycle trigger", () => {
    expect(source).toContain("private.protect_listing_server_owned_fields");
    expect(source).toContain("private.reject_direct_coach_venue_audit_writes");
    expect(source).toContain("Coach members cannot change server-owned coach metadata.");
    expect(source).toContain("Venue members cannot change server-owned venue metadata.");
  });

  it("does not enable the stale coach_applications public-submit policy", () => {
    expect(source).toContain("public.coach_applications INSERT");
    expect(source).not.toMatch(
      /grant insert on public\.coach_applications to (authenticated|anon)/i
    );
  });
});
