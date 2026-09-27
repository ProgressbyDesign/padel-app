"use server";

import { revalidatePath } from "next/cache";
import { writeAdminAuditEvent } from "@/lib/admin/audit";
import {
  parseCoachDirectoryIds,
  parseCoachDirectoryRpcResult,
  summarizeCoachUnclaim,
  summarizeCoachVerification,
  type CoachVerificationTarget,
} from "@/lib/admin/coachDirectoryOps";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { getAdminAccount } from "@/lib/auth/adminSession";
import type { LifecycleActionResult } from "@/lib/lifecycle/adminStatus";
import { createClient } from "@/lib/supabase/server";

async function authorizeCoachDirectoryManager(): Promise<
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
      message: "You need an active admin membership to change coaches.",
    };
  }
  if (!hasAdminPermission(account, "profiles.manage")) {
    return {
      ok: false,
      message:
        "You need profile management permission to change coach verification or account ownership.",
    };
  }
  return { ok: true };
}

function rpcErrorMessage(message: string | undefined, fallback: string): string {
  const text = (message ?? "").toLowerCase();
  if (text.includes("profiles.manage") || text.includes("administrators")) {
    return "Only administrators with profile management permission can change these coaches.";
  }
  if (text.includes("authentication is required")) {
    return "Sign in to continue.";
  }
  if (text.includes("row-level security") || text.includes("permission denied")) {
    return "This change was rejected by database permissions.";
  }
  return fallback;
}

function revalidateCoachDirectory(ids: string[]) {
  revalidatePath("/admin");
  revalidatePath("/admin/coaches");
  revalidatePath("/account");
  for (const id of ids) {
    revalidatePath(`/admin/coaches/${id}`);
    revalidatePath(`/account/coaches/${id}`);
  }
}

export async function bulkSetCoachVerification(
  ids: unknown,
  target: unknown
): Promise<LifecycleActionResult> {
  const auth = await authorizeCoachDirectoryManager();
  if (!auth.ok) return auth;

  const parsedTarget: CoachVerificationTarget | null =
    target === "approved" || target === "needs_review" ? target : null;
  if (!parsedTarget) {
    return { ok: false, message: "Choose a valid verification state." };
  }

  const parsed = parseCoachDirectoryIds(ids);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_coach_verification", {
    p_coach_ids: parsed.ids,
    p_verified: parsedTarget === "approved",
  });

  if (error) {
    return {
      ok: false,
      message: rpcErrorMessage(error.message, "Coach verification could not be updated."),
    };
  }

  const result = parseCoachDirectoryRpcResult(data);
  if (!result) {
    return { ok: false, message: "Coach verification could not be verified." };
  }

  if (result.updatedIds.length > 0) {
    revalidateCoachDirectory(result.updatedIds);
  }

  void writeAdminAuditEvent({
    action:
      parsedTarget === "approved"
        ? "coach.verification_verified"
        : "coach.verification_unverified",
    targetType: "coach",
    targetId: result.updatedIds[0] ?? parsed.ids[0] ?? null,
    details: {
      operation:
        parsedTarget === "approved" ? "bulk_verify" : "bulk_unverify",
      previousState:
        parsedTarget === "approved" ? "needs_review" : "approved",
      newState: parsedTarget,
      updatedIds: result.updatedIds,
      alreadyIds: result.alreadyIds,
      missingIds: result.missingIds,
    },
  }).catch(() => undefined);

  return {
    ok: true,
    message: summarizeCoachVerification(parsedTarget, result),
  };
}

export async function bulkUnclaimCoaches(
  ids: unknown
): Promise<LifecycleActionResult> {
  const auth = await authorizeCoachDirectoryManager();
  if (!auth.ok) return auth;

  const parsed = parseCoachDirectoryIds(ids);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_unclaim_coaches", {
    p_coach_ids: parsed.ids,
  });

  if (error) {
    return {
      ok: false,
      message: rpcErrorMessage(
        error.message,
        "Coach account ownership could not be removed."
      ),
    };
  }

  const result = parseCoachDirectoryRpcResult(data);
  if (!result) {
    return {
      ok: false,
      message: "Coach account ownership could not be verified.",
    };
  }

  if (result.updatedIds.length > 0) {
    revalidateCoachDirectory(result.updatedIds);
  }

  void writeAdminAuditEvent({
    action: "coach.account_unclaimed",
    targetType: "coach",
    targetId: result.updatedIds[0] ?? parsed.ids[0] ?? null,
    details: {
      operation: "bulk_unclaim",
      updatedIds: result.updatedIds,
      alreadyIds: result.alreadyIds,
      missingIds: result.missingIds,
    },
  }).catch(() => undefined);

  return {
    ok: true,
    message: summarizeCoachUnclaim(result),
  };
}
