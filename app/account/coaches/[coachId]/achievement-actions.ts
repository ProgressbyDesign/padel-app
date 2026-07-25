"use server";

import { revalidatePath } from "next/cache";
import { validateAchievementInput } from "@/lib/coachAchievements";
import { isValidCoachId } from "@/lib/queries/managedCoachShell";
import { createClient } from "@/lib/supabase/server";

export type AchievementActionResult = {
  ok: boolean;
  message: string;
};

async function requireCoachMembership(coachId: string): Promise<string | null> {
  if (!isValidCoachId(coachId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string" || !userId) return null;

  const { data: membership, error: membershipError } = await supabase
    .from("coach_memberships")
    .select("coach_id")
    .eq("coach_id", coachId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError || !membership) return null;
  return userId;
}

function revalidateAchievementPaths(coachId: string) {
  revalidatePath(`/account/coaches/${coachId}`);
  revalidatePath(`/account/coaches/${coachId}/achievements`);
  revalidatePath(`/coach/${coachId}`);
  revalidatePath("/coaches");
}

export async function createCoachAchievement(
  coachId: string,
  input: {
    title: string;
    description: string;
    year: string;
    is_highlight: boolean;
  }
): Promise<AchievementActionResult> {
  const userId = await requireCoachMembership(coachId);
  if (!userId) {
    return { ok: false, message: "You do not have permission to edit this coach." };
  }

  const validated = validateAchievementInput(input);
  if (!validated.ok) return { ok: false, message: validated.message };

  const supabase = await createClient();
  const { error } = await supabase.from("coach_achievements").insert({
    coach_id: coachId,
    title: validated.value.title,
    description: validated.value.description,
    year: validated.value.year,
    is_highlight: validated.value.is_highlight,
  });

  if (error) {
    return { ok: false, message: "The achievement could not be added." };
  }

  revalidateAchievementPaths(coachId);
  return { ok: true, message: "Achievement added." };
}

export async function updateCoachAchievement(
  coachId: string,
  achievementId: string,
  input: {
    title: string;
    description: string;
    year: string;
    is_highlight: boolean;
  }
): Promise<AchievementActionResult> {
  const userId = await requireCoachMembership(coachId);
  if (!userId || !isValidCoachId(achievementId)) {
    return { ok: false, message: "You do not have permission to edit this coach." };
  }

  const validated = validateAchievementInput(input);
  if (!validated.ok) return { ok: false, message: validated.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("coach_achievements")
    .update({
      title: validated.value.title,
      description: validated.value.description,
      year: validated.value.year,
      is_highlight: validated.value.is_highlight,
    })
    .eq("id", achievementId)
    .eq("coach_id", coachId);

  if (error) {
    return { ok: false, message: "The achievement could not be updated." };
  }

  revalidateAchievementPaths(coachId);
  return { ok: true, message: "Achievement updated." };
}

export async function deleteCoachAchievement(
  coachId: string,
  achievementId: string
): Promise<AchievementActionResult> {
  const userId = await requireCoachMembership(coachId);
  if (!userId || !isValidCoachId(achievementId)) {
    return { ok: false, message: "You do not have permission to edit this coach." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("coach_achievements")
    .delete()
    .eq("id", achievementId)
    .eq("coach_id", coachId);

  if (error) {
    return { ok: false, message: "The achievement could not be deleted." };
  }

  revalidateAchievementPaths(coachId);
  return { ok: true, message: "Achievement deleted." };
}

export async function setCoachAchievementHighlight(
  coachId: string,
  achievementId: string,
  isHighlight: boolean
): Promise<AchievementActionResult> {
  const userId = await requireCoachMembership(coachId);
  if (!userId || !isValidCoachId(achievementId)) {
    return { ok: false, message: "You do not have permission to edit this coach." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("coach_achievements")
    .update({ is_highlight: isHighlight })
    .eq("id", achievementId)
    .eq("coach_id", coachId);

  if (error) {
    return { ok: false, message: "The highlight could not be updated." };
  }

  revalidateAchievementPaths(coachId);
  return {
    ok: true,
    message: isHighlight ? "Marked as highlight." : "Highlight removed.",
  };
}
