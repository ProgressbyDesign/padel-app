import { describe, expect, it } from "vitest";
import { hasListingSearch, buildCoachListingQuery, buildVenueListingQuery, parseCoachListingParams, parseVenueListingParams } from "./listingUrlParams";
import { buildMarketplaceSearchUrl } from "./marketplaceSearch";
describe("discovery and result navigation", () => {
 it("shows discovery for bare and tracking-only URLs", () => { expect(hasListingSearch({})).toBe(false); expect(hasListingSearch({utm_source:"email"})).toBe(false); });
 it("preserves existing filtered links", () => { expect(hasListingSearch({location:"Malaga"})).toBe(true); expect(hasListingSearch({level:"Beginner"})).toBe(true); });
 it.each(["coaches","venues"] as const)("blank %s search opens results", mode => { expect(buildMarketplaceSearchUrl({mode,location:"",entity:""})).toBe(`/${mode}?view=results`); });
 it("clearing filters stays in results", () => { expect(buildCoachListingQuery(parseCoachListingParams({})).get("view")).toBe("results"); expect(buildVenueListingQuery(parseVenueListingParams({})).get("view")).toBe("results"); });
});
