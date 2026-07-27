import { describe, expect, it } from "vitest";
import {
  resolveWorkspaceDestination,
  type AccountNavContext,
} from "@/lib/workspace/destination";

function baseContext(
  overrides: Partial<AccountNavContext> = {}
): AccountNavContext {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    email: "user@example.com",
    fullName: "Test User",
    coaches: [],
    venues: [],
    isAdmin: false,
    preference: { type: null, entityId: null },
    avatarPath: null,
    avatarUpdatedAt: null,
    avatarUrl: null,
    ...overrides,
  };
}

describe("resolveWorkspaceDestination", () => {
  it("uses stored coach when valid", () => {
    const coachId = "22222222-2222-4222-8222-222222222222";
    expect(
      resolveWorkspaceDestination(
        baseContext({
          coaches: [{ id: coachId, name: "Coach" }],
          preference: { type: "coach", entityId: coachId },
        })
      )
    ).toBe(`/account/coaches/${coachId}`);
  });

  it("falls back when stored entity is invalid", () => {
    const coachA = "22222222-2222-4222-8222-222222222222";
    const coachB = "55555555-5555-4555-8555-555555555555";
    // Invalid preference with multiple coaches → personal
    expect(
      resolveWorkspaceDestination(
        baseContext({
          coaches: [
            { id: coachA, name: "Coach A" },
            { id: coachB, name: "Coach B" },
          ],
          preference: {
            type: "coach",
            entityId: "33333333-3333-4333-8333-333333333333",
          },
        })
      )
    ).toBe("/account/personal");
    // Invalid preference with a single coach → that coach (default)
    expect(
      resolveWorkspaceDestination(
        baseContext({
          coaches: [{ id: coachA, name: "Coach A" }],
          preference: {
            type: "coach",
            entityId: "33333333-3333-4333-8333-333333333333",
          },
        })
      )
    ).toBe(`/account/coaches/${coachA}`);
  });

  it("defaults to the only coach", () => {
    const coachId = "22222222-2222-4222-8222-222222222222";
    expect(
      resolveWorkspaceDestination(
        baseContext({
          coaches: [{ id: coachId, name: "Coach" }],
        })
      )
    ).toBe(`/account/coaches/${coachId}`);
  });

  it("defaults to the only venue", () => {
    const venueId = "44444444-4444-4444-8444-444444444444";
    expect(
      resolveWorkspaceDestination(
        baseContext({
          venues: [{ id: venueId, name: "Venue" }],
        })
      )
    ).toBe(`/account/venues/${venueId}`);
  });

  it("uses personal when both coach and venue exist", () => {
    expect(
      resolveWorkspaceDestination(
        baseContext({
          coaches: [
            {
              id: "22222222-2222-4222-8222-222222222222",
              name: "Coach",
            },
          ],
          venues: [
            {
              id: "44444444-4444-4444-8444-444444444444",
              name: "Venue",
            },
          ],
        })
      )
    ).toBe("/account/personal");
  });

  it("honours admin preference when authorised", () => {
    expect(
      resolveWorkspaceDestination(
        baseContext({
          isAdmin: true,
          preference: { type: "admin", entityId: null },
        })
      )
    ).toBe("/admin");
  });

  it("ignores admin preference when not authorised", () => {
    expect(
      resolveWorkspaceDestination(
        baseContext({
          isAdmin: false,
          preference: { type: "admin", entityId: null },
        })
      )
    ).toBe("/account/personal");
  });
});
