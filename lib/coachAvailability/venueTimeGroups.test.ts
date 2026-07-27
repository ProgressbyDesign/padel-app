import { describe, expect, it } from "vitest";
import {
  dedupeVenueSessionOptions,
  groupVenueSessionsByStart,
  sessionOptionKey,
  type VenueSessionOption,
} from "@/lib/coachAvailability/venueTimeGroups";

function option(
  overrides: Partial<VenueSessionOption> &
    Pick<VenueSessionOption, "coachId" | "relationshipId" | "startsAt" | "endsAt">
): VenueSessionOption {
  return {
    coachName: overrides.coachName ?? "Coach",
    coachImageUrl: null,
    coachRole: null,
    timezone: "Europe/Madrid",
    durationMinutes: 60,
    priceAmountMinor: 4500,
    currency: "GBP",
    ...overrides,
  };
}

describe("venue time grouping", () => {
  it("preserves multiple coaches at the same timestamp", () => {
    const startsAt = "2026-07-29T07:00:00.000Z";
    const endsAt = "2026-07-29T08:00:00.000Z";
    const groups = groupVenueSessionsByStart([
      option({
        coachId: "a",
        coachName: "Test coach 1",
        relationshipId: "rel-a",
        startsAt,
        endsAt,
      }),
      option({
        coachId: "b",
        coachName: "Venue test",
        relationshipId: "rel-b",
        startsAt,
        endsAt,
        priceAmountMinor: 3500,
      }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.options).toHaveLength(2);
    expect(groups[0]?.options.map((o) => o.coachName).sort()).toEqual([
      "Test coach 1",
      "Venue test",
    ]);
  });

  it("dedupes only on relationshipId + startsAt + endsAt", () => {
    const startsAt = "2026-07-29T07:00:00.000Z";
    const endsAt = "2026-07-29T08:00:00.000Z";
    const endsAtAlt = "2026-07-29T08:30:00.000Z";
    const deduped = dedupeVenueSessionOptions([
      option({
        coachId: "a",
        relationshipId: "rel-a",
        startsAt,
        endsAt,
      }),
      option({
        coachId: "a",
        relationshipId: "rel-a",
        startsAt,
        endsAt,
      }),
      option({
        coachId: "a",
        relationshipId: "rel-a",
        startsAt,
        endsAt: endsAtAlt,
      }),
    ]);
    expect(deduped).toHaveLength(2);
    expect(sessionOptionKey(deduped[0]!)).toBe(`rel-a|${startsAt}|${endsAt}`);
  });
});
