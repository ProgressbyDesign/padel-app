"use server";
import { revalidatePath } from "next/cache";
import { reviewMutation } from "@/lib/passport/review/mutations";
import type { ReviewInput } from "@/lib/passport/review/validation";

export async function submitAssessmentReview(coachId: string, orderId: string, command: "start_review" | "submit_review", input: ReviewInput): Promise<{ ok: boolean; error?: string }> {
  if (command !== "start_review" && command !== "submit_review") return { ok: false, error: "Invalid assessment action." };
  try {
    await reviewMutation(coachId, orderId, command, input);
    revalidatePath(`/account/coaches/${coachId}/assessments`);
    revalidatePath(`/account/coaches/${coachId}/assessments/${orderId}`);
    revalidatePath(`/account/development`, "layout");
    return { ok: true };
  } catch {
    // Validation guidance is also displayed before submission. Never serialize
    // database/provider diagnostics or personal data to the browser.
    return { ok: false, error: "The review could not be saved. Check every field and refresh your permissions or video status. Retry unchanged feedback safely after a connection error." };
  }
}
