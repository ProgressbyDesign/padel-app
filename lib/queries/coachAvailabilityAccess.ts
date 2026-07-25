import "server-only";

import { getAdminAccount } from "@/lib/auth/adminSession";
import {
  isValidCoachId,
  loadManagedCoachShell,
  type ManagedCoachShell,
} from "@/lib/queries/managedCoachShell";
import { createClient } from "@/lib/supabase/server";

/** Coach members or operations admins may open availability management UI. */
export async function loadCoachAvailabilityAccess(
  coachId: string
): Promise<ManagedCoachShell | null> {
  const shell = await loadManagedCoachShell(coachId);
  if (shell) return shell;

  if (!isValidCoachId(coachId)) return null;
  const admin = await getAdminAccount();
  if (!admin) return null;

  const supabase = await createClient();
  const { data: coach, error } = await supabase
    .from("coaches")
    .select("id, name, role, is_approved, data_quality_status")
    .eq("id", coachId)
    .maybeSingle();
  if (error || !coach) return null;

  return {
    id: String(coach.id),
    name: coach.name,
    role: coach.role,
    is_approved: coach.is_approved,
    data_quality_status: coach.data_quality_status,
    membershipRole: "owner",
    primaryLocation: null,
  };
}
