import { describe, expect, it } from "vitest";
import {
  countUniqueDestinations,
  destinationKey,
  parseCourtCount,
  sumKnownCourts,
} from "./statsMath";

describe("homepage stats math", () => {
  it("ignores missing or non-positive court counts", () => {
    expect(parseCourtCount(null)).toBe(0);
    expect(parseCourtCount("8")).toBe(8);
    expect(sumKnownCourts([{ courts: 4 }, { courts: null }, { courts: 0 }, { courts: "2" }])).toBe(
      6
    );
  });

  it("returns zero for empty venue lists", () => {
    expect(sumKnownCourts([])).toBe(0);
    expect(countUniqueDestinations([])).toBe(0);
  });

  it("counts unique city/country destinations once", () => {
    expect(destinationKey("Marbella", "Spain")).toBe("marbella|spain");
    expect(
      countUniqueDestinations([
        { city: "Marbella", country: "Spain" },
        { city: "Marbella", country: "Spain" },
        { city: "Barcelona", country: "Spain" },
        { city: null, country: "Sweden" },
        { city: "  ", country: null },
      ])
    ).toBe(3);
  });
});
