import { describe, expect, it } from "vitest";
import {
  directorySourceLabel,
  directoryStatusLabel,
  directoryVerificationLabel,
  filterProfileDirectoryRows,
  mapCoachDirectoryRow,
  mapVenueDirectoryRow,
  matchesProfileDirectoryFilter,
  parseProfileDirectorySearchParams,
  PROFILE_DIRECTORY_FILTERS,
  profileDirectoryHref,
  type ProfileDirectoryRow,
} from "@/lib/admin/profileDirectory";

function row(
  overrides: Partial<ProfileDirectoryRow> & Pick<ProfileDirectoryRow, "id" | "name">
): ProfileDirectoryRow {
  return {
    location: null,
    source: "import",
    sourceLabel: "Imported",
    isApproved: true,
    hasAccount: false,
    launchSelectionStatus: "unselected",
    publicationStatus: "private",
    completionPercent: 33,
    href: profileDirectoryHref("coach", overrides.id),
    ...overrides,
  };
}

describe("admin profile directory mapping", () => {
  it("includes draft unselected imported coaches and links to lifecycle pages", () => {
    const mapped = mapCoachDirectoryRow({
      id: "coach-imported",
      name: "Imported Coach",
      source: "import",
      is_approved: true,
      launch_selection_status: "unselected",
      publication_status: "private",
      image_url: null,
      coach_locations: [{ city: "Marbella", country: "Spain", is_primary: true }],
      coach_memberships: [],
    });

    expect(mapped.publicationStatus).toBe("private");
    expect(directoryStatusLabel(mapped.publicationStatus)).toBe("Draft");
    expect(mapped.launchSelectionStatus).toBe("unselected");
    expect(mapped.sourceLabel).toBe("Imported");
    expect(mapped.hasAccount).toBe(false);
    expect(mapped.href).toBe("/admin/coaches/coach-imported");
    expect(mapped.location).toBe("Marbella, Spain");
  });

  it("maps venue rows to the existing venue lifecycle path", () => {
    const mapped = mapVenueDirectoryRow({
      id: "venue-1",
      name: "Club One",
      city: "Lisbon",
      country: "Portugal",
      source: "application",
      is_approved: false,
      launch_selection_status: "selected",
      publication_status: "published",
      venue_memberships: [{ user_id: "user-1" }],
    });

    expect(mapped.href).toBe("/admin/venues/venue-1");
    expect(mapped.hasAccount).toBe(true);
    expect(mapped.sourceLabel).toBe("Application");
    expect(directoryVerificationLabel(mapped.isApproved)).toBe("Needs review");
    expect(directoryStatusLabel(mapped.publicationStatus)).toBe("Published");
  });
});

describe("admin profile directory filters", () => {
  const dataset: ProfileDirectoryRow[] = [
    row({
      id: "imported-private",
      name: "Imported Private",
      source: "import",
      launchSelectionStatus: "unselected",
      publicationStatus: "private",
      hasAccount: false,
    }),
    row({
      id: "selected-private",
      name: "Top Ten Coach",
      source: "import",
      launchSelectionStatus: "selected",
      publicationStatus: "private",
      hasAccount: false,
    }),
    row({
      id: "published-managed",
      name: "Published Coach",
      source: "application",
      launchSelectionStatus: "selected",
      publicationStatus: "published",
      hasAccount: true,
    }),
    row({
      id: "suspended",
      name: "Suspended Coach",
      source: "crawler",
      launchSelectionStatus: "excluded",
      publicationStatus: "suspended",
      hasAccount: false,
    }),
  ];

  it("does not hide draft or unselected imported profiles from the default list", () => {
    const ids = filterProfileDirectoryRows(dataset, {
      q: "",
      filter: "all",
    }).map((item) => item.id);
    expect(ids).toContain("imported-private");
    expect(ids).toContain("selected-private");
    expect(ids).toContain("published-managed");
  });

  it("filters draft, published, suspended, managed, unclaimed, imported and application", () => {
    expect(
      filterProfileDirectoryRows(dataset, { q: "", filter: "draft" }).map(
        (item) => item.id
      )
    ).toEqual(["imported-private", "selected-private"]);

    expect(
      filterProfileDirectoryRows(dataset, { q: "", filter: "published" }).map(
        (item) => item.id
      )
    ).toEqual(["published-managed"]);

    expect(
      filterProfileDirectoryRows(dataset, { q: "", filter: "suspended" }).map(
        (item) => item.id
      )
    ).toEqual(["suspended"]);

    expect(
      filterProfileDirectoryRows(dataset, { q: "", filter: "managed" }).map(
        (item) => item.id
      )
    ).toEqual(["published-managed"]);

    expect(
      filterProfileDirectoryRows(dataset, { q: "", filter: "unclaimed" }).map(
        (item) => item.id
      )
    ).toEqual(["imported-private", "selected-private", "suspended"]);

    expect(
      filterProfileDirectoryRows(dataset, { q: "", filter: "imported" }).map(
        (item) => item.id
      )
    ).toEqual(["imported-private", "selected-private", "suspended"]);

    expect(
      filterProfileDirectoryRows(dataset, { q: "", filter: "application" }).map(
        (item) => item.id
      )
    ).toEqual(["published-managed"]);
  });

  it("does not expose selected/unselected launch filters", () => {
    expect(PROFILE_DIRECTORY_FILTERS).toEqual([
      "all",
      "draft",
      "published",
      "suspended",
      "managed",
      "unclaimed",
      "imported",
      "application",
    ]);
    expect(PROFILE_DIRECTORY_FILTERS).not.toContain("selected");
    expect(PROFILE_DIRECTORY_FILTERS).not.toContain("unselected");
    expect(PROFILE_DIRECTORY_FILTERS).not.toContain("private");
  });

  it("searches by coach name without applying public publication rules", () => {
    const matches = filterProfileDirectoryRows(dataset, {
      q: "imported",
      filter: "all",
    });
    expect(matches.map((item) => item.id)).toEqual(["imported-private"]);
    expect(matches[0]?.publicationStatus).toBe("private");
    expect(matchesProfileDirectoryFilter(dataset[0], "all")).toBe(true);
  });

  it("parses filter query params and maps legacy private to draft", () => {
    expect(parseProfileDirectorySearchParams({})).toEqual({
      q: "",
      filter: "all",
      page: 1,
    });
    expect(
      parseProfileDirectorySearchParams({ filter: "draft", q: " Ana ", page: "2" })
    ).toMatchObject({ filter: "draft", q: "Ana", page: 2 });
    expect(parseProfileDirectorySearchParams({ filter: "private" }).filter).toBe(
      "draft"
    );
    expect(parseProfileDirectorySearchParams({ filter: "selected" }).filter).toBe(
      "all"
    );
    expect(parseProfileDirectorySearchParams({ filter: "banana" }).filter).toBe(
      "all"
    );
  });

  it("labels source values used by import and application paths", () => {
    expect(directorySourceLabel("import")).toBe("Imported");
    expect(directorySourceLabel("crawler")).toBe("Crawler");
    expect(directorySourceLabel("application")).toBe("Application");
    expect(directoryStatusLabel("private")).toBe("Draft");
    expect(directoryStatusLabel("published")).toBe("Published");
    expect(directoryStatusLabel("suspended")).toBe("Suspended");
  });
});
