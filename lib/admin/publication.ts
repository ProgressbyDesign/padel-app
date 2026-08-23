import {
  isPublicationStatus,
  type PublicationStatus,
} from "@/lib/lifecycle/constants";

export const PROFILE_PUBLICATION_KINDS = ["coach", "venue"] as const;
export type ProfilePublicationKind = (typeof PROFILE_PUBLICATION_KINDS)[number];

export const BULK_PUBLICATION_MAX_IDS = 100;

/** Same UUID shape as coach/venue profile IDs. */
export const PROFILE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PublicationRow = {
  id: string;
  publication_status: PublicationStatus;
};

export type ParsePublicationIdsResult =
  | { ok: true; ids: string[] }
  | { ok: false; message: string };

export type ClassifiedPublicationIds = {
  draftIds: string[];
  publishedIds: string[];
  suspendedIds: string[];
  missingIds: string[];
};

export function isProfilePublicationKind(
  value: unknown
): value is ProfilePublicationKind {
  return (
    typeof value === "string" &&
    (PROFILE_PUBLICATION_KINDS as readonly string[]).includes(value)
  );
}

export function isValidProfileId(value: unknown): value is string {
  return typeof value === "string" && PROFILE_ID_PATTERN.test(value);
}

export function tableForPublicationKind(
  kind: ProfilePublicationKind
): "coaches" | "venues" {
  return kind === "coach" ? "coaches" : "venues";
}

export function publicationKindNoun(
  kind: ProfilePublicationKind,
  count = 1
): string {
  if (kind === "coach") return count === 1 ? "coach" : "coaches";
  return count === 1 ? "venue" : "venues";
}

export function parsePublicationIds(
  raw: unknown,
  max = BULK_PUBLICATION_MAX_IDS
): ParsePublicationIdsResult {
  if (!Array.isArray(raw)) {
    return { ok: false, message: "Select at least one profile." };
  }
  if (raw.length > max) {
    return {
      ok: false,
      message: `Too many profiles selected. Choose up to ${max} at a time.`,
    };
  }

  const seen = new Set<string>();
  const ids: string[] = [];
  for (const value of raw) {
    if (!isValidProfileId(value)) {
      return { ok: false, message: "One or more selected IDs are invalid." };
    }
    if (seen.has(value)) continue;
    seen.add(value);
    ids.push(value);
  }

  if (ids.length === 0) {
    return { ok: false, message: "Select at least one profile." };
  }

  return { ok: true, ids };
}

export function classifyPublicationRows(
  requestedIds: string[],
  rows: PublicationRow[]
): ClassifiedPublicationIds {
  const byId = new Map(rows.map((row) => [row.id, row.publication_status]));
  const draftIds: string[] = [];
  const publishedIds: string[] = [];
  const suspendedIds: string[] = [];
  const missingIds: string[] = [];

  for (const id of requestedIds) {
    const status = byId.get(id);
    if (!status) {
      missingIds.push(id);
      continue;
    }
    if (status === "private") draftIds.push(id);
    else if (status === "published") publishedIds.push(id);
    else suspendedIds.push(id);
  }

  return { draftIds, publishedIds, suspendedIds, missingIds };
}

export function rowsFromUnknown(
  data: Array<{ id?: unknown; publication_status?: unknown }> | null | undefined
): PublicationRow[] {
  const rows: PublicationRow[] = [];
  for (const row of data ?? []) {
    if (!isValidProfileId(row.id) || !isPublicationStatus(row.publication_status)) {
      continue;
    }
    rows.push({ id: row.id, publication_status: row.publication_status });
  }
  return rows;
}

/** Ordinary publish only mutates Draft (`private`) rows. */
export function idsEligibleForPublish(classified: ClassifiedPublicationIds): string[] {
  return classified.draftIds;
}

/** Ordinary unpublish only mutates Published rows. */
export function idsEligibleForUnpublish(
  classified: ClassifiedPublicationIds
): string[] {
  return classified.publishedIds;
}

export function canOrdinaryPublish(status: unknown): boolean {
  return isPublicationStatus(status) && status === "private";
}

export function canOrdinaryUnpublish(status: unknown): boolean {
  return isPublicationStatus(status) && status === "published";
}

export function ordinaryPublicationAction(
  status: unknown
): "publish" | "unpublish" | "none" {
  if (canOrdinaryPublish(status)) return "publish";
  if (canOrdinaryUnpublish(status)) return "unpublish";
  return "none";
}

/** Publish patch — never includes launch_selection_status. */
export function ordinaryPublishPatch(): { publication_status: "published" } {
  return { publication_status: "published" };
}

/** Unpublish patch — Draft is stored as `private`. */
export function ordinaryUnpublishPatch(): { publication_status: "private" } {
  return { publication_status: "private" };
}

export function exceptionalSuspendPatch(): { publication_status: "suspended" } {
  return { publication_status: "suspended" };
}

export function exceptionalRestoreDraftPatch(): { publication_status: "private" } {
  return { publication_status: "private" };
}

export function publishIgnoresLaunchSelection(
  launchSelectionStatus: unknown
): boolean {
  void launchSelectionStatus;
  return true;
}

function countPhrase(
  count: number,
  singular: string,
  plural: string
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function summarizeBulkPublish(
  kind: ProfilePublicationKind,
  classified: ClassifiedPublicationIds,
  mutatedCount: number
): string {
  const noun = publicationKindNoun(kind, mutatedCount);
  const parts = [
    mutatedCount > 0
      ? `${mutatedCount} ${noun} published.`
      : `No ${publicationKindNoun(kind, 2)} published.`,
  ];
  if (classified.publishedIds.length > 0) {
    parts.push(
      classified.publishedIds.length === 1
        ? "1 was already published."
        : `${classified.publishedIds.length} were already published.`
    );
  }
  if (classified.suspendedIds.length > 0) {
    parts.push(
      `${countPhrase(
        classified.suspendedIds.length,
        "suspended profile was",
        "suspended profiles were"
      )} skipped.`
    );
  }
  if (classified.missingIds.length > 0) {
    parts.push(
      `${countPhrase(
        classified.missingIds.length,
        "selected profile was",
        "selected profiles were"
      )} not found.`
    );
  }
  return parts.join(" ");
}

export function summarizeBulkUnpublish(
  kind: ProfilePublicationKind,
  classified: ClassifiedPublicationIds,
  mutatedCount: number
): string {
  const noun = publicationKindNoun(kind, mutatedCount);
  const parts = [
    mutatedCount > 0
      ? `${mutatedCount} ${noun} unpublished.`
      : `No ${publicationKindNoun(kind, 2)} unpublished.`,
  ];
  if (classified.draftIds.length > 0) {
    parts.push(
      classified.draftIds.length === 1
        ? "1 was already a draft."
        : `${classified.draftIds.length} were already drafts.`
    );
  }
  if (classified.suspendedIds.length > 0) {
    parts.push(
      `${countPhrase(
        classified.suspendedIds.length,
        "suspended profile was",
        "suspended profiles were"
      )} skipped.`
    );
  }
  if (classified.missingIds.length > 0) {
    parts.push(
      `${countPhrase(
        classified.missingIds.length,
        "selected profile was",
        "selected profiles were"
      )} not found.`
    );
  }
  return parts.join(" ");
}

export function currentPageSelectionState(
  pageIds: string[],
  selectedIds: readonly string[]
): { allSelected: boolean; someSelected: boolean } {
  if (pageIds.length === 0) return { allSelected: false, someSelected: false };
  const selected = new Set(selectedIds);
  const selectedOnPage = pageIds.filter((id) => selected.has(id)).length;
  return {
    allSelected: selectedOnPage === pageIds.length,
    someSelected: selectedOnPage > 0 && selectedOnPage < pageIds.length,
  };
}

export function applySelectAllPage(
  pageIds: string[],
  selectedIds: readonly string[],
  checked: boolean
): string[] {
  const next = new Set(selectedIds);
  for (const id of pageIds) {
    if (checked) next.add(id);
    else next.delete(id);
  }
  return [...next];
}
