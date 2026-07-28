"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validateDisplayName } from "@/lib/accountSettings/validation";
import { requireAdminAccess } from "@/lib/auth/adminSession";
import { createClient } from "@/lib/supabase/server";

export type AdminWelcomeResult = {
  ok: boolean;
  message: string;
};

export async function completeAdminWelcomeAction(
  fullName: string
): Promise<AdminWelcomeResult> {
  const account = await requireAdminAccess("access-denied");
  const validated = validateDisplayName(fullName);
  if (!validated.ok) {
    return { ok: false, message: validated.message };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: validated.value,
      last_workspace_type: "admin",
      last_workspace_entity_id: null,
    })
    .eq("id", account.id);

  if (error) {
    // Profile may not have propagated yet for brand-new magic-link users.
    const { error: upsertError } = await supabase.from("profiles").upsert(
      {
        id: account.id,
        full_name: validated.value,
        last_workspace_type: "admin",
        last_workspace_entity_id: null,
      },
      { onConflict: "id" }
    );
    if (upsertError) {
      return { ok: false, message: "Your name could not be saved. Please try again." };
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/welcome");
  revalidatePath("/account");
  revalidatePath("/account/settings");
  revalidatePath("/", "layout");
  redirect("/admin");
}
