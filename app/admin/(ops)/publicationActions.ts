"use server";

import { revalidatePath } from "next/cache";
import { writeAdminAuditEvent } from "@/lib/admin/audit";
import { hasAdminPermission } from "@/lib/admin/permissions";
import {
  classifyPublicationRows,
  exceptionalRestoreDraftPatch,
  exceptionalSuspendPatch,
  idsEligibleForPublish,
  idsEligibleForUnpublish,
  isProfilePublicationKind,
  ordinaryPublishPatch,
  ordinaryUnpublishPatch,
  parsePublicationIds,
  publicationKindNoun,
  rowsFromUnknown,
  summarizeBulkPublish,
  summarizeBulkUnpublish,
  tableForPublicationKind,
  type ProfilePublicationKind,
} from "@/lib/admin/publication";
import { getAdminAccount } from "@/lib/auth/adminSession";
import { publicationAdminLabel } from "@/lib/lifecycle/adminStatus";
import type { LifecycleActionResult } from "@/lib/lifecycle/adminStatus";
import { createClient } from "@/lib/supabase/server";

export type { LifecycleActionResult };

async function authorizePublicationManager(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || typeof data?.claims?.sub !== "string") {
    return { ok: false, message: "Sign in to continue." };
  }

  const account = await getAdminAccount();
  if (!account) {
    return {
      ok: false,
      message: "You need an active admin membership to change publication.",
    };
  }
  if (!hasAdminPermission(account, "profiles.manage")) {
    return {
      ok: false,
      message:
        "You need profile management permission to change publication.",
    };
  }
  return { ok: true };
}

function lifecycleErrorMessage(
  message: string | undefined,
  fallback: string
): string {
  const text = (message ?? "").toLowerCase();
  if (text.includes("profiles.manage") || text.includes("administrators")) {
    return "Only administrators with profile management permission can change publication.";
  }
  if (text.includes("row-level security") || text.includes("permission denied")) {
    return "This change was rejected by database permissions.";
  }
  return fallback;
}

function revalidatePublishedProfiles(
  kind: ProfilePublicationKind,
  ids: string[]
) {
  revalidatePath("/");
  revalidatePath("/admin");
  if (kind === "coach") {
    revalidatePath("/admin/coaches");
    revalidatePath("/coaches");
    revalidatePath("/account");
    for (const id of ids) {
      revalidatePath(`/admin/coaches/${id}`);
      revalidatePath(`/coach/${id}`);
      revalidatePath(`/account/coaches/${id}`);
    }
    return;
  }

  if (kind === "venue") {
    revalidatePath("/admin/venues");
    revalidatePath("/venues");
    revalidatePath("/account");
    for (const id of ids) {
      revalidatePath(`/admin/venues/${id}`);
      revalidatePath(`/venue/${id}`);
      revalidatePath(`/account/venues/${id}`);
    }
  }
}

function parseKind(kind: unknown): ProfilePublicationKind | null {
  return isProfilePublicationKind(kind) ? kind : null;
}

async function loadPublicationRows(
  kind: ProfilePublicationKind,
  ids: string[]
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(tableForPublicationKind(kind))
    .select("id, publication_status")
    .in("id", ids);

  if (error) {
    return {
      ok: false as const,
      message: lifecycleErrorMessage(
        error.message,
        "Those profiles could not be loaded."
      ),
    };
  }

  return { ok: true as const, rows: rowsFromUnknown(data) };
}

async function updatePublicationStatus(
  kind: ProfilePublicationKind,
  ids: string[],
  currentStatus: "private" | "published" | "suspended",
  patch: { publication_status: "private" | "published" | "suspended" }
): Promise<{ ok: true; updatedIds: string[] } | { ok: false; message: string }> {
  if (ids.length === 0) return { ok: true, updatedIds: [] };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(tableForPublicationKind(kind))
    .update(patch)
    .in("id", ids)
    .eq("publication_status", currentStatus)
    .select("id");

  if (error) {
    return {
      ok: false,
      message: lifecycleErrorMessage(
        error.message,
        "Publication could not be updated."
      ),
    };
  }

  const updatedIds = (data ?? [])
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string");
  return { ok: true, updatedIds };
}

function writePublicationAudit(
  kind: ProfilePublicationKind,
  details: Record<string, unknown>,
  targetId?: string
) {
  void writeAdminAuditEvent({
    action: "profile.admin_updated",
    targetType: kind,
    targetId: targetId ?? null,
    details,
  }).catch(() => undefined);
}

export async function publishProfile(
  kind: unknown,
  id: unknown
): Promise<LifecycleActionResult> {
  const auth = await authorizePublicationManager();
  if (!auth.ok) return auth;

  const parsedKind = parseKind(kind);
  const parsed = parsePublicationIds([id], 1);
  if (!parsedKind || !parsed.ok) {
    return { ok: false, message: "That profile could not be found." };
  }

  const loaded = await loadPublicationRows(parsedKind, parsed.ids);
  if (!loaded.ok) return loaded;
  const classified = classifyPublicationRows(parsed.ids, loaded.rows);
  const noun = publicationKindNoun(parsedKind);

  if (classified.missingIds.length > 0) {
    return { ok: false, message: "That profile could not be found." };
  }
  if (classified.suspendedIds.length > 0) {
    return {
      ok: false,
      message: `Suspended ${noun} profiles cannot be published from this action.`,
    };
  }
  if (classified.publishedIds.length > 0) {
    return { ok: true, message: `That ${noun} is already published.` };
  }

  const result = await updatePublicationStatus(
    parsedKind,
    classified.draftIds,
    "private",
    ordinaryPublishPatch()
  );
  if (!result.ok) return result;
  if (result.updatedIds.length === 0) {
    return { ok: false, message: `The ${noun} could not be published.` };
  }

  revalidatePublishedProfiles(parsedKind, result.updatedIds);
  writePublicationAudit(
    parsedKind,
    {
      operation: "publish",
      publicationStatus: publicationAdminLabel("published"),
    },
    result.updatedIds[0]
  );
  return {
    ok: true,
    message: `${noun.charAt(0).toUpperCase()}${noun.slice(1)} published. The profile is now publicly visible.`,
  };
}

export async function unpublishProfile(
  kind: unknown,
  id: unknown
): Promise<LifecycleActionResult> {
  const auth = await authorizePublicationManager();
  if (!auth.ok) return auth;

  const parsedKind = parseKind(kind);
  const parsed = parsePublicationIds([id], 1);
  if (!parsedKind || !parsed.ok) {
    return { ok: false, message: "That profile could not be found." };
  }

  const loaded = await loadPublicationRows(parsedKind, parsed.ids);
  if (!loaded.ok) return loaded;
  const classified = classifyPublicationRows(parsed.ids, loaded.rows);
  const noun = publicationKindNoun(parsedKind);

  if (classified.missingIds.length > 0) {
    return { ok: false, message: "That profile could not be found." };
  }
  if (classified.suspendedIds.length > 0) {
    return {
      ok: false,
      message: `Suspended ${noun} profiles stay suspended until restored from Advanced.`,
    };
  }
  if (classified.draftIds.length > 0) {
    return { ok: true, message: `That ${noun} is already a draft.` };
  }

  const result = await updatePublicationStatus(
    parsedKind,
    classified.publishedIds,
    "published",
    ordinaryUnpublishPatch()
  );
  if (!result.ok) return result;
  if (result.updatedIds.length === 0) {
    return { ok: false, message: `The ${noun} could not be unpublished.` };
  }

  revalidatePublishedProfiles(parsedKind, result.updatedIds);
  writePublicationAudit(
    parsedKind,
    {
      operation: "unpublish",
      publicationStatus: publicationAdminLabel("private"),
    },
    result.updatedIds[0]
  );
  return {
    ok: true,
    message: `${noun.charAt(0).toUpperCase()}${noun.slice(1)} is a draft again and no longer publicly visible.`,
  };
}

export async function bulkPublishProfiles(
  kind: unknown,
  ids: unknown
): Promise<LifecycleActionResult> {
  const auth = await authorizePublicationManager();
  if (!auth.ok) return auth;

  const parsedKind = parseKind(kind);
  if (!parsedKind) {
    return { ok: false, message: "Those profiles could not be found." };
  }
  const parsed = parsePublicationIds(ids);
  if (!parsed.ok) return parsed;

  const loaded = await loadPublicationRows(parsedKind, parsed.ids);
  if (!loaded.ok) return loaded;
  const classified = classifyPublicationRows(parsed.ids, loaded.rows);
  const eligible = idsEligibleForPublish(classified);

  const result = await updatePublicationStatus(
    parsedKind,
    eligible,
    "private",
    ordinaryPublishPatch()
  );
  if (!result.ok) return result;

  if (result.updatedIds.length > 0) {
    revalidatePublishedProfiles(parsedKind, result.updatedIds);
  }
  writePublicationAudit(parsedKind, {
    operation: "bulk_publish",
    publicationStatus: publicationAdminLabel("published"),
    updatedIds: result.updatedIds,
    alreadyPublishedIds: classified.publishedIds,
    skippedSuspendedIds: classified.suspendedIds,
  });

  return {
    ok: true,
    message: summarizeBulkPublish(
      parsedKind,
      classified,
      result.updatedIds.length
    ),
  };
}

export async function bulkUnpublishProfiles(
  kind: unknown,
  ids: unknown
): Promise<LifecycleActionResult> {
  const auth = await authorizePublicationManager();
  if (!auth.ok) return auth;

  const parsedKind = parseKind(kind);
  if (!parsedKind) {
    return { ok: false, message: "Those profiles could not be found." };
  }
  const parsed = parsePublicationIds(ids);
  if (!parsed.ok) return parsed;

  const loaded = await loadPublicationRows(parsedKind, parsed.ids);
  if (!loaded.ok) return loaded;
  const classified = classifyPublicationRows(parsed.ids, loaded.rows);
  const eligible = idsEligibleForUnpublish(classified);

  const result = await updatePublicationStatus(
    parsedKind,
    eligible,
    "published",
    ordinaryUnpublishPatch()
  );
  if (!result.ok) return result;

  if (result.updatedIds.length > 0) {
    revalidatePublishedProfiles(parsedKind, result.updatedIds);
  }
  writePublicationAudit(parsedKind, {
    operation: "bulk_unpublish",
    publicationStatus: publicationAdminLabel("private"),
    updatedIds: result.updatedIds,
    alreadyDraftIds: classified.draftIds,
    skippedSuspendedIds: classified.suspendedIds,
  });

  return {
    ok: true,
    message: summarizeBulkUnpublish(
      parsedKind,
      classified,
      result.updatedIds.length
    ),
  };
}

export async function suspendProfile(
  kind: unknown,
  id: unknown
): Promise<LifecycleActionResult> {
  const auth = await authorizePublicationManager();
  if (!auth.ok) return auth;

  const parsedKind = parseKind(kind);
  const parsed = parsePublicationIds([id], 1);
  if (!parsedKind || !parsed.ok) {
    return { ok: false, message: "That profile could not be found." };
  }

  const loaded = await loadPublicationRows(parsedKind, parsed.ids);
  if (!loaded.ok) return loaded;
  const classified = classifyPublicationRows(parsed.ids, loaded.rows);
  const noun = publicationKindNoun(parsedKind);

  if (classified.missingIds.length > 0) {
    return { ok: false, message: "That profile could not be found." };
  }
  if (classified.suspendedIds.length > 0) {
    return { ok: true, message: `That ${noun} is already suspended.` };
  }

  const currentStatus = classified.publishedIds.length > 0 ? "published" : "private";
  const result = await updatePublicationStatus(
    parsedKind,
    parsed.ids,
    currentStatus,
    exceptionalSuspendPatch()
  );
  if (!result.ok) return result;
  if (result.updatedIds.length === 0) {
    return { ok: false, message: `The ${noun} could not be suspended.` };
  }

  revalidatePublishedProfiles(parsedKind, result.updatedIds);
  writePublicationAudit(
    parsedKind,
    {
      operation: "suspend",
      publicationStatus: publicationAdminLabel("suspended"),
    },
    result.updatedIds[0]
  );
  return {
    ok: true,
    message: `${noun.charAt(0).toUpperCase()}${noun.slice(1)} suspended and removed from public surfaces.`,
  };
}

export async function restoreDraftProfile(
  kind: unknown,
  id: unknown
): Promise<LifecycleActionResult> {
  const auth = await authorizePublicationManager();
  if (!auth.ok) return auth;

  const parsedKind = parseKind(kind);
  const parsed = parsePublicationIds([id], 1);
  if (!parsedKind || !parsed.ok) {
    return { ok: false, message: "That profile could not be found." };
  }

  const loaded = await loadPublicationRows(parsedKind, parsed.ids);
  if (!loaded.ok) return loaded;
  const classified = classifyPublicationRows(parsed.ids, loaded.rows);
  const noun = publicationKindNoun(parsedKind);

  if (classified.missingIds.length > 0) {
    return { ok: false, message: "That profile could not be found." };
  }
  if (classified.draftIds.length > 0) {
    return { ok: true, message: `That ${noun} is already a draft.` };
  }
  if (classified.publishedIds.length > 0) {
    return {
      ok: false,
      message: `Use Unpublish to return a published ${noun} to draft.`,
    };
  }

  const result = await updatePublicationStatus(
    parsedKind,
    classified.suspendedIds,
    "suspended",
    exceptionalRestoreDraftPatch()
  );
  if (!result.ok) return result;
  if (result.updatedIds.length === 0) {
    return { ok: false, message: `The ${noun} could not be restored to draft.` };
  }

  revalidatePublishedProfiles(parsedKind, result.updatedIds);
  writePublicationAudit(
    parsedKind,
    {
      operation: "restore_draft",
      publicationStatus: publicationAdminLabel("private"),
    },
    result.updatedIds[0]
  );
  return {
    ok: true,
    message: `${noun.charAt(0).toUpperCase()}${noun.slice(1)} restored to draft. It remains hidden until published.`,
  };
}
