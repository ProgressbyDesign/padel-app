import "server-only";
import { developmentPreviewEnabled } from "@/lib/development/flags";
import { getAdminAccount } from "@/lib/auth/adminSession";
import { hasAdminPermission, type AdminPermission } from "@/lib/admin/permissions";
import { createClient } from "@/lib/supabase/server";
import type { CommandResult, PassportCommands } from "./types";

const adminPermissions: Partial<Record<keyof PassportCommands, AdminPermission>> = {
  publish_standard: "profiles.manage", retire_standard: "profiles.manage", set_assessor: "profiles.manage",
  publish_policy: "team.manage", retire_policy: "team.manage", request_refund: "bookings.manage",
  reassign: "bookings.manage", escalate: "bookings.manage", resolve_escalation: "bookings.manage", revoke_verification: "bookings.manage",
};

/** Ordinary server module, not a Next Server Action. No new HTTP endpoint is exposed.
 * Both the local preview flag and the separate database release switch must be open.
 * SQL repeats authorization and owns every state transition in one transaction.
 */
export async function runPassportCommand<K extends keyof PassportCommands>(
  command: K, payload: PassportCommands[K], requestId: string,
): Promise<CommandResult> {
  if (!developmentPreviewEnabled()) throw new Error("Passport backend is not enabled.");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    throw new Error("A stable UUID request ID is required.");
  }
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) throw new Error("Sign in to continue.");
  const permission = adminPermissions[command];
  if (permission && !hasAdminPermission(await getAdminAccount(), permission)) throw new Error("This operation requires an authorised administrator.");
  const response = await client.rpc("passport_command", { p_command: command, p_payload: payload, p_request_id: requestId });
  if (response.error) throw new Error("The Passport operation could not be completed.");
  return response.data as CommandResult;
}
