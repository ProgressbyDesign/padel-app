"use server";

import { redirect } from "next/navigation";
import {
  isPreferenceAccessible,
  loadOptionalAccountNavContext,
} from "@/lib/workspace/resolve";
import {
  isWorkspaceType,
  workspaceHref,
  type WorkspaceType,
} from "@/lib/workspace/types";
import { createClient } from "@/lib/supabase/server";

export async function setWorkspacePreference(input: {
  type: WorkspaceType;
  entityId?: string | null;
}): Promise<void> {
  const context = await loadOptionalAccountNavContext();
  if (!context) {
    redirect(`/login?next=${encodeURIComponent("/account")}`);
  }

  const type = isWorkspaceType(input.type) ? input.type : "personal";
  const entityId =
    type === "coach" || type === "venue" ? input.entityId ?? null : null;

  if (!isPreferenceAccessible(context, type, entityId)) {
    redirect(workspaceHref("personal"));
  }

  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({
      last_workspace_type: type,
      last_workspace_entity_id: entityId,
    })
    .eq("id", context.id);

  redirect(workspaceHref(type, entityId));
}
