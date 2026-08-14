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
    const required = [
      "grant update on public.profiles to authenticated",
      "grant insert, update on public.coaches to authenticated",
      "grant insert, update on public.venues to authenticated",
      "grant insert, update on public.coach_profile_applications to authenticated",
      "grant insert, update on public.venue_profile_applications to authenticated",
      "grant insert, update on public.coach_application_locations to authenticated",
      "grant insert, update on public.coach_venues to authenticated",
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
      expect(source).toContain(statement);
    }
  });

  it("does not enable the stale coach_applications public-submit policy", () => {
    expect(source).toContain("public.coach_applications INSERT");
    expect(source).not.toMatch(
      /grant insert on public\.coach_applications to (authenticated|anon)/i
    );
  });
});
