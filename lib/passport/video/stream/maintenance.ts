import "server-only";
import { getAdminAccount } from "@/lib/auth/adminSession";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { requireStreamConfig, StreamError, logStreamFailure } from "./config";
import { streamLifecycle, streamStore, uuid, type StreamSession } from "./service";

type Category = "unfinished" | "failed" | "replaced" | "completed";
type Candidate = StreamSession & { category: Category | "awaiting_review"; retention_anchor: string };
export function retentionPolicy(): { version: string; days: Record<Category, number | null> } | null {
  if (process.env.PADEL_PASSPORT_STREAM_RETENTION_APPROVED !== "true") return null;
  const version = process.env.PADEL_PASSPORT_STREAM_RETENTION_VERSION ?? "";
  try {
    const days = JSON.parse(process.env.PADEL_PASSPORT_STREAM_RETENTION_DAYS ?? "{}") as Record<Category, number | null>;
    if (!/^[a-zA-Z0-9_.-]{1,60}$/.test(version) || !["unfinished", "failed", "replaced", "completed"].every((key) => Object.hasOwn(days, key) && (days[key as Category] === null || (typeof days[key as Category] === "number" && days[key as Category]! > 0 && days[key as Category]! <= 3650)))) throw Error();
    return { version, days };
  } catch { throw new StreamError("RETENTION_CONFIG", "The approved retention configuration is invalid."); }
}
async function requireMediaAdmin() {
  if (!hasAdminPermission(await getAdminAccount(), "deletions.manage")) throw new StreamError("ADMIN_REQUIRED", "An authorised administrator is required.", 403);
}
/** Server job/admin integration point. No publicly callable cron or remote
 * subscription is installed. Call repeatedly with nextCursor to cover all rows. */
export async function maintainStreamVideos(after?: string): Promise<{ processed: number; errors: number; nextCursor: string | null }> {
  const config = requireStreamConfig(); await requireMediaAdmin();
  if (after && !uuid(after)) throw new StreamError("INVALID_CURSOR", "Invalid cleanup cursor.", 400);
  const store = streamStore(config), lifecycle = streamLifecycle(config), policy = retentionPolicy();
  const sessions = await store.call<Candidate[]>("list", { after });
  let errors = 0;
  for (let session of sessions) {
    try {
      const originalPhase = session.phase;
      if (!["delete_pending", "failed", "ready"].includes(session.phase)) session = { ...session, ...await lifecycle.reconcile(session) };
      // Reconciliation can change category/anchor. Evaluate on the next pass,
      // after a fresh database projection; never delete a pending coach review.
      const days = session.phase !== originalPhase || session.category === "awaiting_review" ? null : policy?.days[session.category];
      if (session.phase !== "delete_pending" && days != null && Date.parse(session.retention_anchor) + days * 86400000 <= Date.now()) {
        session = { ...session, ...await store.call<StreamSession>("queue_delete", { id: session.id, reason: `Approved retention policy ${policy!.version}: ${session.category}.` }) };
      }
      if (session.phase === "delete_pending") await lifecycle.deleteOwned(session);
    } catch (error) { errors++; logStreamFailure("maintenance", error); }
  }
  return { processed: sessions.length, errors, nextCursor: sessions.length === 50 ? sessions.at(-1)!.id : null };
}
/** Existing account-erasure workflow may call this only after approval. It queues
 * media erasure, not deletion/anonymisation of financial or assessment history. */
export async function queuePlayerStreamErasure(playerId: string, reason: string): Promise<number> {
  const config = requireStreamConfig(); await requireMediaAdmin();
  if (!uuid(playerId) || reason.trim().length < 20) throw new StreamError("ERASURE_REASON", "A player and explicit erasure reason are required.", 400);
  const store = streamStore(config), sessions = await store.call<StreamSession[]>("for_player", { player_id: playerId });
  for (const session of sessions) await store.call("queue_delete", { id: session.id, reason: `Approved player media erasure: ${reason.trim()}` });
  return sessions.length;
}
