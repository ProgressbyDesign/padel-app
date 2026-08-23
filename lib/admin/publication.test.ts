import { describe, expect, it } from "vitest";
import {
  applySelectAllPage,
  BULK_PUBLICATION_MAX_IDS,
  canOrdinaryPublish,
  canOrdinaryUnpublish,
  classifyPublicationRows,
  currentPageSelectionState,
  idsEligibleForPublish,
  idsEligibleForUnpublish,
  ordinaryPublicationAction,
  ordinaryPublishPatch,
  ordinaryUnpublishPatch,
  parsePublicationIds,
  publishIgnoresLaunchSelection,
  summarizeBulkPublish,
  summarizeBulkUnpublish,
  tableForPublicationKind,
  type PublicationRow,
} from "@/lib/admin/publication";

const draft = "11111111-1111-4111-8111-000000000001";
const published = "11111111-1111-4111-8111-000000000002";
const extraDraft = "11111111-1111-4111-8111-000000000003";
const suspended = "11111111-1111-4111-8111-000000000004";
const missing = "11111111-1111-4111-8111-000000000005";

const rows: PublicationRow[] = [
  { id: draft, publication_status: "private" },
  { id: published, publication_status: "published" },
  { id: extraDraft, publication_status: "private" },
  { id: suspended, publication_status: "suspended" },
];

describe("ordinary publication eligibility", () => {
  it("lets a draft profile be published without launch selection", () => {
    expect(canOrdinaryPublish("private")).toBe(true);
    expect(publishIgnoresLaunchSelection("unselected")).toBe(true);
    expect(publishIgnoresLaunchSelection("excluded")).toBe(true);
    expect(ordinaryPublicationAction("private")).toBe("publish");
    expect(ordinaryPublishPatch()).toEqual({ publication_status: "published" });
    expect(ordinaryPublishPatch()).not.toHaveProperty("launch_selection_status");
  });

  it("only unpublishes published rows back to draft/private", () => {
    expect(canOrdinaryUnpublish("published")).toBe(true);
    expect(canOrdinaryUnpublish("private")).toBe(false);
    expect(canOrdinaryUnpublish("suspended")).toBe(false);
    expect(ordinaryPublicationAction("published")).toBe("unpublish");
    expect(ordinaryUnpublishPatch()).toEqual({ publication_status: "private" });
    expect(ordinaryPublicationAction("suspended")).toBe("none");
  });

  it("uses the same table mapping for coaches and venues", () => {
    expect(tableForPublicationKind("coach")).toBe("coaches");
    expect(tableForPublicationKind("venue")).toBe("venues");
  });
});

describe("bulk publication classification", () => {
  it("publishes only draft rows and skips published and suspended", () => {
    const classified = classifyPublicationRows(
      [draft, published, extraDraft, suspended],
      rows
    );
    expect(idsEligibleForPublish(classified)).toEqual([draft, extraDraft]);
    expect(classified.publishedIds).toEqual([published]);
    expect(classified.suspendedIds).toEqual([suspended]);
    expect(
      summarizeBulkPublish("coach", classified, classified.draftIds.length)
    ).toBe(
      "2 coaches published. 1 was already published. 1 suspended profile was skipped."
    );
  });

  it("unpublishes only published rows and leaves draft and suspended unchanged", () => {
    const classified = classifyPublicationRows(
      [draft, published, extraDraft, suspended],
      rows
    );
    expect(idsEligibleForUnpublish(classified)).toEqual([published]);
    expect(classified.draftIds).toEqual([draft, extraDraft]);
    expect(classified.suspendedIds).toEqual([suspended]);
    expect(
      summarizeBulkUnpublish("venue", classified, classified.publishedIds.length)
    ).toBe(
      "1 venue unpublished. 2 were already drafts. 1 suspended profile was skipped."
    );
  });

  it("applies the same classification to coaches and venues", () => {
    const classified = classifyPublicationRows([draft, published], rows);
    expect(idsEligibleForPublish(classified)).toEqual([draft]);
    expect(idsEligibleForUnpublish(classified)).toEqual([published]);
    expect(summarizeBulkPublish("venue", classified, 1)).toContain(
      "1 venue published"
    );
    expect(summarizeBulkUnpublish("coach", classified, 1)).toContain(
      "1 coach unpublished"
    );
  });

  it("deduplicates submitted IDs", () => {
    const parsed = parsePublicationIds([draft, draft, published]);
    expect(parsed).toEqual({ ok: true, ids: [draft, published] });
  });

  it("rejects invalid or excessively large ID lists", () => {
    expect(parsePublicationIds([])).toMatchObject({ ok: false });
    expect(parsePublicationIds("not-an-array")).toMatchObject({ ok: false });
    expect(parsePublicationIds(["not-a-uuid"])).toMatchObject({ ok: false });
    expect(
      parsePublicationIds(
        Array.from({ length: BULK_PUBLICATION_MAX_IDS + 1 }, (_, index) => {
          const n = String(index + 1).padStart(12, "0");
          return `11111111-1111-4111-8111-${n}`;
        })
      )
    ).toMatchObject({ ok: false });
  });

  it("records missing IDs without treating them as draft", () => {
    const classified = classifyPublicationRows([missing], rows);
    expect(classified.missingIds).toEqual([missing]);
    expect(idsEligibleForPublish(classified)).toEqual([]);
    expect(idsEligibleForUnpublish(classified)).toEqual([]);
  });
});

describe("directory page selection", () => {
  const pageIds = [draft, published];

  it("select-all applies only to the current page", () => {
    const selected = applySelectAllPage(pageIds, [extraDraft], true);
    expect(selected).toEqual(expect.arrayContaining([draft, published, extraDraft]));
    expect(selected).toHaveLength(3);
    const cleared = applySelectAllPage(pageIds, selected, false);
    expect(cleared).toEqual([extraDraft]);
  });

  it("tracks header checkbox state for the current page only", () => {
    expect(currentPageSelectionState(pageIds, [])).toEqual({
      allSelected: false,
      someSelected: false,
    });
    expect(currentPageSelectionState(pageIds, [draft])).toEqual({
      allSelected: false,
      someSelected: true,
    });
    expect(currentPageSelectionState(pageIds, [draft, published])).toEqual({
      allSelected: true,
      someSelected: false,
    });
  });
});
