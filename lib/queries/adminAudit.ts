import "server-only";

import {
  ADMIN_AUDIT_ACTIONS,
  humanizeAuditAction,
  sanitizeAuditDetails,
  type AdminAuditAction,
} from "@/lib/admin/audit";
import { requireAdminPermission } from "@/lib/auth/adminSession";
import { createClient } from "@/lib/supabase/server";

export type AdminAuditEventRow = {
  id: string;
  actorUserId: string | null;
  actorRole: string | null;
  actorName: string | null;
  actorEmailHint: string | null;
  action: string;
  actionLabel: string;
  targetType: string;
  targetId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
};

export type AdminAuditFilters = {
  actor?: string | null;
  action?: string | null;
  targetType?: string | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
};

export async function listAdminAuditEvents(
  filters: AdminAuditFilters = {}
): Promise<AdminAuditEventRow[]> {
  await requireAdminPermission("audit.read");
  const supabase = await createClient();

  let query = supabase
    .from("admin_audit_log")
    .select(
      "id, actor_user_id, actor_role, action, target_type, target_id, details, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(filters.limit ?? 100, 1), 300));

  const action = filters.action?.trim();
  if (action && (ADMIN_AUDIT_ACTIONS as readonly string[]).includes(action)) {
    query = query.eq("action", action);
  }

  const targetType = filters.targetType?.trim();
  if (targetType) {
    query = query.eq("target_type", targetType);
  }

  const from = filters.from?.trim();
  if (from) {
    query = query.gte("created_at", `${from}T00:00:00.000Z`);
  }
  const to = filters.to?.trim();
  if (to) {
    query = query.lte("created_at", `${to}T23:59:59.999Z`);
  }

  const { data, error } = await query;
  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[admin-audit] list failed:", error.message);
    }
    throw new Error("Unable to load audit events.");
  }

  const actorIds = [
    ...new Set(
      (data ?? [])
        .map((row) =>
          row.actor_user_id ? String(row.actor_user_id) : null
        )
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const profileMap = new Map<string, string | null>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", actorIds);
    for (const profile of profiles ?? []) {
      profileMap.set(
        String(profile.id),
        typeof profile.full_name === "string"
          ? profile.full_name.trim() || null
          : null
      );
    }
  }

  const actorFilter = filters.actor?.trim().toLowerCase() ?? "";

  const rows: AdminAuditEventRow[] = (data ?? []).map((row) => {
    const actorUserId = row.actor_user_id
      ? String(row.actor_user_id)
      : null;
    const details =
      row.details && typeof row.details === "object" && !Array.isArray(row.details)
        ? sanitizeAuditDetails(row.details as Record<string, unknown>)
        : {};
    return {
      id: String(row.id),
      actorUserId,
      actorRole: row.actor_role ? String(row.actor_role) : null,
      actorName: actorUserId ? (profileMap.get(actorUserId) ?? null) : null,
      actorEmailHint:
        typeof details.email === "string" ? details.email : null,
      action: String(row.action),
      actionLabel: humanizeAuditAction(String(row.action)),
      targetType: String(row.target_type),
      targetId: row.target_id ? String(row.target_id) : null,
      details,
      createdAt: String(row.created_at),
    };
  });

  if (!actorFilter) return rows;

  return rows.filter((row) => {
    const haystack = [
      row.actorName,
      row.actorUserId,
      row.actorRole,
      row.actorEmailHint,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(actorFilter);
  });
}

export function listKnownAuditActions(): AdminAuditAction[] {
  return [...ADMIN_AUDIT_ACTIONS];
}
