import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Best-effort recipient for product emails without service-role auth lookups.
 * Prefer an explicit address, then a coach public contact email.
 */
export async function resolveCoachContactEmail(
  coachId: string | null | undefined
): Promise<string | null> {
  if (!coachId?.trim()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coaches")
    .select("email")
    .eq("id", coachId)
    .maybeSingle();
  if (error || !data) return null;
  const email = typeof data.email === "string" ? data.email.trim() : "";
  return email.includes("@") ? email : null;
}

export function logSkippedRecipient(
  label: string,
  reason: string,
  context?: Record<string, string | null | undefined>
): void {
  console.warn(`[${label}] skipped: ${reason}`, context ?? {});
}
