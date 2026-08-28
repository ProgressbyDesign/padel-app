import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Best-effort recipient for product emails.
 * Prefer an explicit address, then the coach row if the caller can read it.
 * Player-initiated booking mail cannot read coaches.email after the public
 * profile lockdown, so that path uses resolveCoachNotificationEmail().
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

/**
 * Server-only notification routing. Never return this address to a client
 * payload. Not a public profile read.
 */
export async function resolveCoachNotificationEmail(
  coachId: string | null | undefined
): Promise<string | null> {
  const fromCaller = await resolveCoachContactEmail(coachId);
  if (fromCaller) return fromCaller;
  if (!coachId?.trim()) return null;
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("coaches")
      .select("email")
      .eq("id", coachId)
      .maybeSingle();
    if (error || !data) return null;
    const email = typeof data.email === "string" ? data.email.trim() : "";
    return email.includes("@") ? email : null;
  } catch {
    return null;
  }
}

export function logSkippedRecipient(
  label: string,
  reason: string,
  context?: Record<string, string | null | undefined>
): void {
  console.warn(`[${label}] skipped: ${reason}`, context ?? {});
}
