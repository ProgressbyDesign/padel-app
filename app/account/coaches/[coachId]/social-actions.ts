"use server";

import { revalidatePath } from "next/cache";
import { isValidCoachId } from "@/lib/queries/managedCoachShell";
import { createClient } from "@/lib/supabase/server";
import {
  isCoachSocialPlatform,
  isValidCoachSocialId,
  MAX_COACH_SOCIALS,
  normalizeCoachSocialUrl,
  type CoachSocialInput,
  type CoachSocialPlatform,
} from "@/lib/coachSocials";

type CoachSocialFieldErrors = {
  platform?: string;
  url?: string;
};

export type CoachSocialActionResult =
  | { ok: true; message: string }
  | {
      ok: false;
      message: string;
      fieldErrors?: CoachSocialFieldErrors;
    };

type UserSupabaseClient = Awaited<ReturnType<typeof createClient>>;

type ValidatedSocialInput = {
  platform: CoachSocialPlatform;
  url: string;
  isPrimary: boolean;
};

async function hasCoachAccess(
  supabase: UserSupabaseClient,
  coachId: string
): Promise<boolean> {
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return false;

  const { data: membership, error: membershipError } = await supabase
    .from("coach_memberships")
    .select("coach_id")
    .eq("coach_id", coachId)
    .eq("user_id", userId)
    .maybeSingle();

  return !membershipError && Boolean(membership);
}

function validateInput(
  input: CoachSocialInput
):
  | { ok: true; value: ValidatedSocialInput }
  | { ok: false; fieldErrors: CoachSocialFieldErrors } {
  const fieldErrors: CoachSocialFieldErrors = {};
  const platform =
    typeof input?.platform === "string" ? input.platform.trim() : "";
  const rawUrl = typeof input?.url === "string" ? input.url.trim() : "";

  if (!isCoachSocialPlatform(platform)) {
    fieldErrors.platform = "Choose a supported platform.";
  }

  if (!rawUrl) {
    fieldErrors.url = "URL is required.";
  } else if (isCoachSocialPlatform(platform)) {
    const normalized = normalizeCoachSocialUrl(platform, rawUrl);
    if (!normalized.ok) {
      fieldErrors.url = normalized.error;
    } else if (Object.keys(fieldErrors).length === 0) {
      return {
        ok: true,
        value: {
          platform,
          url: normalized.value,
          isPrimary: input?.isPrimary === true,
        },
      };
    }
  }

  return { ok: false, fieldErrors };
}

function revalidateCoachSocials(coachId: string) {
  revalidatePath(`/account/coaches/${coachId}`);
  revalidatePath(`/account/coaches/${coachId}/socials`);
  revalidatePath(`/coach/${coachId}`);
}

async function restorePrimary(
  supabase: UserSupabaseClient,
  coachId: string,
  socialId: string
) {
  await supabase
    .from("coach_socials")
    .update({ is_primary: true })
    .eq("id", socialId)
    .eq("coach_id", coachId);
}

export async function createCoachSocialAction(
  coachId: string,
  input: CoachSocialInput
): Promise<CoachSocialActionResult> {
  if (!isValidCoachId(coachId)) {
    return { ok: false, message: "The social link could not be saved." };
  }

  const supabase = await createClient();
  if (!(await hasCoachAccess(supabase, coachId))) {
    return { ok: false, message: "The social link could not be saved." };
  }

  const validated = validateInput(input);
  if (!validated.ok) {
    return {
      ok: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: validated.fieldErrors,
    };
  }

  const { data: existing, error: existingError } = await supabase
    .from("coach_socials")
    .select("id, platform, is_primary")
    .eq("coach_id", coachId);

  if (existingError) {
    return { ok: false, message: "The social link could not be saved." };
  }

  if (
    existing?.some((social) => social.platform === validated.value.platform)
  ) {
    return {
      ok: false,
      message: "This platform is already linked to the coach.",
      fieldErrors: { platform: "Choose an unused platform." },
    };
  }

  const supportedCount = (existing ?? []).filter((social) =>
    isCoachSocialPlatform(social.platform)
  ).length;
  if (supportedCount >= MAX_COACH_SOCIALS) {
    return {
      ok: false,
      message: "This coach already has all six supported social links.",
    };
  }

  const currentPrimary =
    existing?.find((social) => social.is_primary) ?? null;
  const shouldBePrimary =
    (existing?.length ?? 0) === 0 || validated.value.isPrimary;

  if (shouldBePrimary && currentPrimary) {
    const { data: cleared, error: clearError } = await supabase
      .from("coach_socials")
      .update({ is_primary: false })
      .eq("id", currentPrimary.id)
      .eq("coach_id", coachId)
      .select("id")
      .maybeSingle();
    if (clearError || !cleared) {
      return { ok: false, message: "The social link could not be saved." };
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("coach_socials")
    .insert({
      coach_id: coachId,
      platform: validated.value.platform,
      url: validated.value.url,
      is_primary: shouldBePrimary,
    })
    .select("id")
    .maybeSingle();

  if (insertError || !inserted) {
    if (shouldBePrimary && currentPrimary) {
      await restorePrimary(supabase, coachId, String(currentPrimary.id));
    }
    return { ok: false, message: "The social link could not be saved." };
  }

  revalidateCoachSocials(coachId);
  return { ok: true, message: "Social link added." };
}

export async function updateCoachSocialAction(
  coachId: string,
  socialId: string,
  input: CoachSocialInput
): Promise<CoachSocialActionResult> {
  if (!isValidCoachId(coachId) || !isValidCoachSocialId(socialId)) {
    return { ok: false, message: "The social link could not be updated." };
  }

  const supabase = await createClient();
  if (!(await hasCoachAccess(supabase, coachId))) {
    return { ok: false, message: "The social link could not be updated." };
  }

  const { data: target, error: targetError } = await supabase
    .from("coach_socials")
    .select("id, coach_id, platform, url, is_primary, created_at")
    .eq("id", socialId)
    .eq("coach_id", coachId)
    .maybeSingle();

  if (targetError || !target) {
    return { ok: false, message: "The social link could not be updated." };
  }
  if (!isCoachSocialPlatform(target.platform)) {
    return {
      ok: false,
      message: "Legacy social links can only be deleted.",
    };
  }

  const validated = validateInput(input);
  if (!validated.ok) {
    return {
      ok: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: validated.fieldErrors,
    };
  }

  const { data: coachSocials, error: socialsError } = await supabase
    .from("coach_socials")
    .select("id, platform, is_primary")
    .eq("coach_id", coachId);

  if (socialsError) {
    return { ok: false, message: "The social link could not be updated." };
  }

  if (
    coachSocials?.some(
      (social) =>
        String(social.id) !== socialId &&
        social.platform === validated.value.platform
    )
  ) {
    return {
      ok: false,
      message: "This platform is already linked to the coach.",
      fieldErrors: { platform: "Choose an unused platform." },
    };
  }

  const currentPrimary =
    coachSocials?.find(
      (social) =>
        social.is_primary && String(social.id) !== String(target.id)
    ) ?? null;
  const needsPrimarySwitch =
    validated.value.isPrimary && !target.is_primary && currentPrimary;

  if (needsPrimarySwitch && currentPrimary) {
    const { data: cleared, error: clearError } = await supabase
      .from("coach_socials")
      .update({ is_primary: false })
      .eq("id", currentPrimary.id)
      .eq("coach_id", coachId)
      .select("id")
      .maybeSingle();
    if (clearError || !cleared) {
      return { ok: false, message: "The social link could not be updated." };
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from("coach_socials")
    .update({
      platform: validated.value.platform,
      url: validated.value.url,
      is_primary: validated.value.isPrimary,
    })
    .eq("id", socialId)
    .eq("coach_id", coachId)
    .select("id")
    .maybeSingle();

  if (updateError || !updated) {
    if (needsPrimarySwitch && currentPrimary) {
      await restorePrimary(supabase, coachId, String(currentPrimary.id));
    }
    return { ok: false, message: "The social link could not be updated." };
  }

  revalidateCoachSocials(coachId);
  return { ok: true, message: "Social link updated." };
}

export async function setPrimaryCoachSocialAction(
  coachId: string,
  socialId: string
): Promise<CoachSocialActionResult> {
  if (!isValidCoachId(coachId) || !isValidCoachSocialId(socialId)) {
    return { ok: false, message: "The social link could not be updated." };
  }

  const supabase = await createClient();
  if (!(await hasCoachAccess(supabase, coachId))) {
    return { ok: false, message: "The social link could not be updated." };
  }

  const { data: target, error: targetError } = await supabase
    .from("coach_socials")
    .select("id, platform, is_primary")
    .eq("id", socialId)
    .eq("coach_id", coachId)
    .maybeSingle();

  if (targetError || !target || !isCoachSocialPlatform(target.platform)) {
    return { ok: false, message: "The social link could not be updated." };
  }
  if (target.is_primary) {
    return { ok: true, message: "This is already the primary social link." };
  }

  const { data: currentPrimary, error: primaryError } = await supabase
    .from("coach_socials")
    .select("id")
    .eq("coach_id", coachId)
    .eq("is_primary", true)
    .maybeSingle();

  if (primaryError) {
    return { ok: false, message: "The social link could not be updated." };
  }

  if (currentPrimary) {
    const { data: cleared, error: clearError } = await supabase
      .from("coach_socials")
      .update({ is_primary: false })
      .eq("id", currentPrimary.id)
      .eq("coach_id", coachId)
      .select("id")
      .maybeSingle();
    if (clearError || !cleared) {
      return { ok: false, message: "The social link could not be updated." };
    }
  }

  const { data: selected, error: selectError } = await supabase
    .from("coach_socials")
    .update({ is_primary: true })
    .eq("id", socialId)
    .eq("coach_id", coachId)
    .select("id")
    .maybeSingle();

  if (selectError || !selected) {
    if (currentPrimary) {
      await restorePrimary(supabase, coachId, String(currentPrimary.id));
    }
    return { ok: false, message: "The social link could not be updated." };
  }

  revalidateCoachSocials(coachId);
  return { ok: true, message: "Primary social link updated." };
}

export async function deleteCoachSocialAction(
  coachId: string,
  socialId: string
): Promise<CoachSocialActionResult> {
  if (!isValidCoachId(coachId) || !isValidCoachSocialId(socialId)) {
    return { ok: false, message: "The social link could not be deleted." };
  }

  const supabase = await createClient();
  if (!(await hasCoachAccess(supabase, coachId))) {
    return { ok: false, message: "The social link could not be deleted." };
  }

  const { data: target, error: targetError } = await supabase
    .from("coach_socials")
    .select("id")
    .eq("id", socialId)
    .eq("coach_id", coachId)
    .maybeSingle();

  if (targetError || !target) {
    return { ok: false, message: "The social link could not be deleted." };
  }

  const { data: deleted, error: deleteError } = await supabase
    .from("coach_socials")
    .delete()
    .eq("id", socialId)
    .eq("coach_id", coachId)
    .select("id")
    .maybeSingle();

  if (deleteError || !deleted) {
    return { ok: false, message: "The social link could not be deleted." };
  }

  revalidateCoachSocials(coachId);
  return { ok: true, message: "Social link deleted." };
}
