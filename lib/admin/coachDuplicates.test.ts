import { describe, expect, it } from "vitest";
import {
  compareNames,
  duplicateRetrievalFilters,
  duplicateSearchTokens,
  MAX_DUPLICATE_CANDIDATES,
  normalizeCoachName,
  rankDuplicateCandidates,
  scoreDuplicateCandidate,
  vowelFlexibleNameToken,
  type DuplicateCoachSource,
} from "./coachDuplicates";

function coach(overrides: Partial<DuplicateCoachSource> & { id: string }): DuplicateCoachSource {
  return {
    name: null,
    role: null,
    publicationStatus: "private",
    isClaimed: false,
    managedByOtherAccount: false,
    locations: [],
    ...overrides,
  };
}

describe("normalizeCoachName", () => {
  it("lowercases, strips diacritics and punctuation, collapses whitespace", () => {
    expect(normalizeCoachName("  Juan  MARTÍN-López ")).toBe("juan martin lopez");
    expect(normalizeCoachName("J. Martin")).toBe("j martin");
    expect(normalizeCoachName(null)).toBe("");
  });

  it("produces safe search tokens, longest first, skipping initials", () => {
    expect(duplicateSearchTokens("J. Martín López")).toEqual(["martin", "lopez"]);
    expect(duplicateSearchTokens("Al Bo")).toEqual([]);
  });

  it("adds a vowel-wildcard filter so Martin can retrieve Martín", () => {
    expect(vowelFlexibleNameToken("martin")).toBe("m_rt_n");
    expect(vowelFlexibleNameToken("juan")).toBeNull();
    expect(duplicateRetrievalFilters("Juan Martin")).toEqual([
      "name.ilike.%martin%",
      "name.ilike.%m_rt_n%",
      "name.ilike.%juan%",
    ]);
    expect(duplicateRetrievalFilters("Juan Martín")).toEqual([
      "name.ilike.%martin%",
      "name.ilike.%m_rt_n%",
      "name.ilike.%juan%",
    ]);
  });
});

describe("compareNames", () => {
  it("treats identical names in any order or accenting as the same", () => {
    expect(compareNames("Juan Martin", "Juan Martín")).toBe("same");
    expect(compareNames("Martin Juan", "Juan Martin")).toBe("same");
  });

  it("flags shared surname with matching first name or initial as similar", () => {
    expect(compareNames("Juan Martin", "J. Martin")).toBe("similar");
    expect(compareNames("Juan Martin", "Juan Carlos Martin")).toBe("similar");
  });

  it("ignores unrelated names and surname-only overlaps without a first name", () => {
    expect(compareNames("Juan Martin", "Pedro Martin")).toBeNull();
    expect(compareNames("Juan Martin", "Martin")).toBeNull();
    expect(compareNames("Juan Martin", "Juan Garcia")).toBeNull();
    expect(compareNames("", "Juan Martin")).toBeNull();
  });
});

describe("scoreDuplicateCandidate", () => {
  const applicant = {
    fullName: "Juan Martin",
    roleLabel: "Padel coach",
    locations: [{ city: "Marbella", country: "Spain" }],
  };

  it("treats an identical name alone as a possible duplicate, never confirmed", () => {
    const candidate = scoreDuplicateCandidate(applicant, coach({ id: "a", name: "Juan Martín" }));
    expect(candidate).not.toBeNull();
    expect(candidate?.reasons).toEqual(["same_name"]);
    expect(candidate?.score).toBe(3);
  });

  it("requires corroboration for merely similar names", () => {
    expect(scoreDuplicateCandidate(applicant, coach({ id: "a", name: "J. Martin" }))).toBeNull();

    const withCity = scoreDuplicateCandidate(
      applicant,
      coach({
        id: "b",
        name: "J. Martin",
        locations: [{ city: "Marbella", country: "Spain", isPrimary: true }],
      })
    );
    expect(withCity?.reasons).toEqual(["similar_name", "same_city"]);
    expect(withCity?.primaryLocation).toBe("Marbella, Spain");

    const withRole = scoreDuplicateCandidate(
      applicant,
      coach({ id: "c", name: "J. Martin", role: "Padel Coach" })
    );
    expect(withRole?.reasons).toEqual(["similar_name", "same_role"]);
  });

  it("prefers city over country and adds role as a weaker signal", () => {
    const candidate = scoreDuplicateCandidate(
      applicant,
      coach({
        id: "a",
        name: "Juan Martin",
        role: "padel coach",
        locations: [{ city: "Madrid", country: "Spain", isPrimary: true }],
      })
    );
    expect(candidate?.reasons).toEqual(["same_name", "same_country", "same_role"]);
    expect(candidate?.score).toBe(4);
  });
});

describe("rankDuplicateCandidates", () => {
  it("returns the strongest few candidates, unmanaged first on ties", () => {
    const applicant = {
      fullName: "Juan Martin",
      roleLabel: null,
      locations: [{ city: "Marbella", country: "Spain" }],
    };
    const ranked = rankDuplicateCandidates(applicant, [
      coach({ id: "managed", name: "Juan Martin", managedByOtherAccount: true }),
      coach({ id: "plain", name: "Juan Martin" }),
      coach({
        id: "local",
        name: "Juan Martin",
        locations: [{ city: "Marbella", country: "Spain", isPrimary: true }],
      }),
      coach({ id: "unrelated", name: "Pedro Sanchez" }),
      coach({ id: "similar", name: "J. Martin" }),
    ]);

    expect(ranked.map((candidate) => candidate.id)).toEqual(["local", "plain", "managed"]);
  });

  it("caps the list at a small, useful selection", () => {
    const applicant = { fullName: "Juan Martin", roleLabel: null, locations: [] };
    const ranked = rankDuplicateCandidates(
      applicant,
      ["a", "b", "c", "d", "e"].map((id) => coach({ id, name: "Juan Martin" }))
    );
    expect(ranked).toHaveLength(MAX_DUPLICATE_CANDIDATES);
  });

  it("returns nothing when the applicant has no usable name", () => {
    expect(
      rankDuplicateCandidates({ fullName: "", roleLabel: null, locations: [] }, [
        coach({ id: "a", name: "Juan Martin" }),
      ])
    ).toEqual([]);
  });
});
