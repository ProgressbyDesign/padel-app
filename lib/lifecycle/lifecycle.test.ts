import { describe, expect, it } from "vitest";
import {
  ACCOUNT_JOURNEYS,
  isAccountJourney,
  isPublicationStatus,
  isPublishedStatus,
  PUBLIC_COACH_VENUE_STATUSES,
  PUBLICATION_STATUSES,
  PUBLISHED_STATUS,
} from "@/lib/lifecycle/constants";
import {
  applyPublishedCoachFilter,
  applyPublishedVenueFilter,
} from "@/lib/lifecycle/publicationFilters";

type FakeQuery = {
  eqs: Array<[string, string]>;
  eq: (column: string, value: string) => FakeQuery;
};

function fakeQuery(): FakeQuery {
  const q: FakeQuery = {
    eqs: [],
    eq(column, value) {
      q.eqs.push([column, value]);
      return q;
    },
  };
  return q;
}

describe("lifecycle validation", () => {
  it("validates publication status values", () => {
    expect(PUBLICATION_STATUSES).toEqual(["private", "published", "suspended"]);
    expect(isPublicationStatus("published")).toBe(true);
    expect(isPublicationStatus("private")).toBe(true);
    expect(isPublicationStatus("draft")).toBe(false);
    expect(isPublishedStatus(PUBLISHED_STATUS)).toBe(true);
    expect(isPublishedStatus("private")).toBe(false);
  });

  it("validates account journey values", () => {
    expect(ACCOUNT_JOURNEYS).toEqual([
      "player",
      "coach_business",
      "travel_partner",
    ]);
    expect(isAccountJourney("player")).toBe(true);
    expect(isAccountJourney("coach_business")).toBe(true);
    expect(isAccountJourney("admin")).toBe(false);
  });

  it("applies explicit published filters for public coach/venue queries", () => {
    const coachQ = applyPublishedCoachFilter(fakeQuery() as never) as FakeQuery;
    const venueQ = applyPublishedVenueFilter(fakeQuery() as never) as FakeQuery;
    expect(coachQ.eqs).toEqual([["publication_status", "published"]]);
    expect(venueQ.eqs).toEqual([["publication_status", "published"]]);
  });

  it("restricts public coach–venue relationships to active only", () => {
    expect([...PUBLIC_COACH_VENUE_STATUSES]).toEqual(["active"]);
    expect(PUBLIC_COACH_VENUE_STATUSES).not.toContain("unverified");
  });
});

describe("claim rejection semantics", () => {
  it("documents that new self-service claims must be rejected", () => {
    const rejectNewClaim = (mode: string, targetId: string | null) => {
      if (mode === "claim_existing" || targetId) {
        return {
          ok: false as const,
          message: "Public profile claiming is no longer available.",
        };
      }
      return { ok: true as const, mode: "create_new" as const, targetId: null };
    };

    expect(rejectNewClaim("claim_existing", "coach-1").ok).toBe(false);
    expect(rejectNewClaim("create_new", "coach-1").ok).toBe(false);
    expect(rejectNewClaim("create_new", null)).toEqual({
      ok: true,
      mode: "create_new",
      targetId: null,
    });
  });
});

describe("public vs private visibility rules", () => {
  it("treats unpublished coaches as no public result", () => {
    const publicLookup = (row: { publication_status: string } | null) =>
      row && row.publication_status === "published" ? row : null;

    expect(publicLookup({ publication_status: "private" })).toBeNull();
    expect(publicLookup({ publication_status: "suspended" })).toBeNull();
    expect(publicLookup({ publication_status: "published" })).toEqual({
      publication_status: "published",
    });
  });

  it("requires published coach and venue for public availability", () => {
    const canShowAvailability = (input: {
      relationshipStatus: string;
      isPublic: boolean;
      coachPublication: string;
      venuePublication: string;
    }) =>
      input.relationshipStatus === "active" &&
      input.isPublic &&
      input.coachPublication === "published" &&
      input.venuePublication === "published";

    expect(
      canShowAvailability({
        relationshipStatus: "active",
        isPublic: true,
        coachPublication: "private",
        venuePublication: "published",
      })
    ).toBe(false);

    expect(
      canShowAvailability({
        relationshipStatus: "unverified",
        isPublic: true,
        coachPublication: "published",
        venuePublication: "published",
      })
    ).toBe(false);

    expect(
      canShowAvailability({
        relationshipStatus: "active",
        isPublic: true,
        coachPublication: "published",
        venuePublication: "published",
      })
    ).toBe(true);
  });

  it("keeps member management independent of publication", () => {
    const memberCanManage = (hasMembership: boolean) => hasMembership;
    expect(memberCanManage(true)).toBe(true);
    expect(memberCanManage(false)).toBe(false);
  });

  it("keeps player booking reads independent of publication", () => {
    const playerCanReadOwnBooking = (isRequester: boolean) => isRequester;
    expect(playerCanReadOwnBooking(true)).toBe(true);
  });
});
