import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SubmissionRecord, SubmissionOrder, SubmissionAttempt } from "./contracts";
import { videoProviderMode } from "./localConfig";

const orderFields = "id,skill_id,state,payment_state,refund_state,terms_snapshot,review_due_at,created_at,active_attempt_id";
const attemptFields = "id,attempt_number,upload_state,validation_state,recording_guidance,failure_reason";

export async function loadSubmissionRecords(orderId?: string): Promise<SubmissionRecord[]> {
  if (!videoProviderMode()) return [];
  const client = await createClient();
  const { data: auth, error: authError } = await client.auth.getClaims();
  if (authError || !auth?.claims?.sub) throw new Error("Sign in to continue.");
  let query = client.from("pp_orders").select(orderFields).eq("player_id", auth.claims.sub).order("created_at", { ascending: false }).limit(50);
  if (orderId) query = query.eq("id", orderId);
  const { data, error } = await query;
  if (error) throw new Error("Local assessment records are unavailable. Check the local setup.");
  const rows = data ?? [];
  if (!rows.length) return [];
  const ids = rows.map((row) => row.active_attempt_id).filter((id): id is string => !!id);
  const [skills, attempts] = await Promise.all([
    client.from("pp_skills").select("id,title").in("id", [...new Set(rows.map((row) => row.skill_id))]),
    ids.length ? client.from("pp_submission_attempts").select(attemptFields).in("id", ids) : { data: [], error: null },
  ]);
  if (skills.error || attempts.error) throw new Error("Your upload status could not be loaded.");
  return rows.map((row) => ({ order: row as SubmissionOrder,
    attempt: (attempts.data ?? []).find((attempt) => attempt.id === row.active_attempt_id) as SubmissionAttempt | undefined ?? null,
    skillTitle: (skills.data ?? []).find((skill) => skill.id === row.skill_id)?.title ?? row.skill_id,
  }));
}
