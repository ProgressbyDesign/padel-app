import "server-only";
import { developmentPreviewEnabled } from "@/lib/development/flags";
import { createClient } from "@/lib/supabase/server";
import type { AssessmentOrder, CoachReview, PassportVerification } from "./types";

export type PassportSkillRecord = {
  player_id: string;
  skill_id: string;
  standard_id: string;
  review_id: string;
  latest_outcome: "developing" | "verified";
  next_step: string;
  practice_tasks: string[];
  reviewed_at: string;
  active_verification_count: number;
};

/** Future Phase A integration point. Uses the caller's existing SSR client/RLS,
 * never a service key or an arbitrary player ID. Not called by the mock UI.
 */
export async function loadOwnPassport(): Promise<{
  orders: AssessmentOrder[];
  reviews: CoachReview[];
  verifications: PassportVerification[];
  skillRecords: PassportSkillRecord[];
}> {
  if (!developmentPreviewEnabled()) throw new Error("Passport backend is not enabled.");
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  const id = data?.claims?.sub;
  if (error || !id) throw new Error("Sign in to continue.");
  const [orders, verifications, skillRecords] = await Promise.all([
    client.from("pp_orders").select("*").eq("player_id", id).order("created_at", { ascending: false }),
    client.from("pp_skill_verifications").select("*").eq("player_id", id).order("verified_at", { ascending: false }),
    client.from("pp_passport_skill_records").select("*").eq("player_id", id),
  ]);
  if (orders.error || verifications.error || skillRecords.error) throw new Error("Your Passport could not be loaded.");
  const orderIds = (orders.data as AssessmentOrder[]).map((order) => order.id);
  const reviews = orderIds.length
    ? await client.from("pp_reviews").select("*").in("order_id", orderIds).order("sequence", { ascending: false })
    : { data: [], error: null };
  if (reviews.error) throw new Error("Your assessment history could not be loaded.");
  return { orders: orders.data as AssessmentOrder[], reviews: reviews.data as CoachReview[], verifications: verifications.data as PassportVerification[], skillRecords: skillRecords.data as PassportSkillRecord[] };
}
