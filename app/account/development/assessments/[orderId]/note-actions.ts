"use server";
import { revalidatePath } from "next/cache";
import { reviewClient, validId } from "@/lib/passport/review/access";
export async function saveSubmissionNote(orderId: string, note: string): Promise<{ ok: boolean }> {
  if (!validId(orderId) || typeof note !== "string" || note.length > 1000) return { ok: false };
  try {
    const { client } = await reviewClient();
    const result = await client.rpc("passport_save_submission_note", { p_order: orderId, p_note: note });
    if (result.error) return { ok: false };
    revalidatePath(`/account/development/assessments/${orderId}`);
    return { ok: true };
  } catch { return { ok: false }; }
}
