import {
  BULK_PUBLICATION_MAX_IDS,
  parsePublicationIds,
  publicationKindNoun,
  type ParsePublicationIdsResult,
} from "@/lib/admin/publication";

export const COACH_DIRECTORY_BULK_MAX_IDS = BULK_PUBLICATION_MAX_IDS;

export type CoachVerificationTarget = "approved" | "needs_review";

export type CoachDirectoryRpcResult = {
  updatedIds: string[];
  alreadyIds: string[];
  missingIds: string[];
};

export function parseCoachDirectoryIds(
  raw: unknown,
  max = COACH_DIRECTORY_BULK_MAX_IDS
): ParsePublicationIdsResult {
  return parsePublicationIds(raw, max);
}

export function verificationDirectoryLabel(
  target: CoachVerificationTarget
): string {
  return target === "approved" ? "Approved" : "Needs review";
}

export function verificationConfirmMessage(
  count: number,
  target: CoachVerificationTarget
): string | null {
  if (target === "approved") return null;
  const noun = publicationKindNoun("coach", count);
  return `Mark ${count} ${noun} as needs review?\n\nTheir profiles and publication status will not be changed.`;
}

export function unclaimConfirmMessage(count: number): string {
  const noun = publicationKindNoun("coach", count);
  return `Make ${count} ${noun} unclaimed?\n\nThis removes account ownership from these coach profiles.\n\nThe coach profiles and user accounts will not be deleted.`;
}

export function summarizeCoachVerification(
  target: CoachVerificationTarget,
  result: CoachDirectoryRpcResult
): string {
  const label =
    target === "approved" ? "approved" : "needs review";
  const mutated = result.updatedIds.length;
  const noun = publicationKindNoun("coach", mutated);
  const parts = [
    mutated > 0
      ? `${mutated} ${noun} marked as ${label}.`
      : `No coaches marked as ${label}.`,
  ];
  if (result.alreadyIds.length > 0) {
    parts.push(
      result.alreadyIds.length === 1
        ? `1 was already ${label}.`
        : `${result.alreadyIds.length} were already ${label}.`
    );
  }
  if (result.missingIds.length > 0) {
    parts.push(
      result.missingIds.length === 1
        ? "1 selected coach was not found."
        : `${result.missingIds.length} selected coaches were not found.`
    );
  }
  return parts.join(" ");
}

export function summarizeCoachUnclaim(result: CoachDirectoryRpcResult): string {
  const mutated = result.updatedIds.length;
  const noun = publicationKindNoun("coach", mutated);
  const parts = [
    mutated > 0
      ? `${mutated} ${noun} made unclaimed.`
      : "No coaches made unclaimed.",
  ];
  if (result.alreadyIds.length > 0) {
    parts.push(
      result.alreadyIds.length === 1
        ? "1 was already unclaimed."
        : `${result.alreadyIds.length} were already unclaimed.`
    );
  }
  if (result.missingIds.length > 0) {
    parts.push(
      result.missingIds.length === 1
        ? "1 selected coach was not found."
        : `${result.missingIds.length} selected coaches were not found.`
    );
  }
  return parts.join(" ");
}

export function parseCoachDirectoryRpcResult(
  data: unknown
): CoachDirectoryRpcResult | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const raw = data as Record<string, unknown>;
  return {
    updatedIds: stringIdList(raw.updatedIds ?? raw.updated_ids),
    alreadyIds: stringIdList(raw.alreadyIds ?? raw.already_ids),
    missingIds: stringIdList(raw.missingIds ?? raw.missing_ids),
  };
}

function stringIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string" && id.length > 0);
}
