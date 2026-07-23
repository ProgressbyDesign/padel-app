"use server";

import { revalidatePath } from "next/cache";
import { isValidVenueId } from "@/lib/queries/managedVenue";
import { createClient } from "@/lib/supabase/server";
import {
  isValidVenueSocialId,
  isVenueSocialPlatform,
  MAX_VENUE_SOCIALS,
  MAX_VENUE_SOCIAL_URL_LENGTH,
  normalizeVenueSocialUrl,
  type VenueSocialInput,
  type VenueSocialPlatform,
} from "@/lib/venueSocials";

type VenueSocialFieldErrors = {
  platform?: string;
  url?: string;
};

export type VenueSocialActionResult =
  | { ok: true; message: string }
  | {
      ok: false;
      message: string;
      fieldErrors?: VenueSocialFieldErrors;
    };

type UserSupabaseClient = Awaited<ReturnType<typeof createClient>>;

type ValidatedSocialInput = {
  platform: VenueSocialPlatform;
  url: string;
  isPrimary: boolean;
};

async function hasVenueAccess(
  supabase: UserSupabaseClient,
  venueId: string
): Promise<boolean> {
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return false;

  const { data: membership, error: membershipError } = await supabase
    .from("venue_memberships")
    .select("venue_id")
    .eq("venue_id", venueId)
    .eq("user_id", userId)
    .maybeSingle();

  return !membershipError && Boolean(membership);
}

function validateInput(
  input: VenueSocialInput
):
  | { ok: true; value: ValidatedSocialInput }
  | { ok: false; fieldErrors: VenueSocialFieldErrors } {
  const fieldErrors: VenueSocialFieldErrors = {};
  const platform =
    typeof input?.platform === "string" ? input.platform.trim() : "";
  const rawUrl = typeof input?.url === "string" ? input.url.trim() : "";

  if (!isVenueSocialPlatform(platform)) {
    fieldErrors.platform = "Choose a supported platform.";
  }

  if (!rawUrl) {
    fieldErrors.url = "URL is required.";
  } else if (rawUrl.length > MAX_VENUE_SOCIAL_URL_LENGTH) {
    fieldErrors.url = `URL must be ${MAX_VENUE_SOCIAL_URL_LENGTH} characters or fewer.`;
  } else if (isVenueSocialPlatform(platform)) {
    const normalized = normalizeVenueSocialUrl(platform, rawUrl);
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

function revalidateVenueSocials(venueId: string) {
  revalidatePath(`/account/venues/${venueId}`);
  revalidatePath(`/account/venues/${venueId}/socials`);
  revalidatePath(`/venue/${venueId}`);
}

async function restorePrimary(
  supabase: UserSupabaseClient,
  venueId: string,
  socialId: string | number
) {
  await supabase
    .from("venue_socials")
    .update({ is_primary: true })
    .eq("id", socialId)
    .eq("venue_id", venueId);
}

export async function createVenueSocialAction(
  venueId: string,
  input: VenueSocialInput
): Promise<VenueSocialActionResult> {
  if (!isValidVenueId(venueId)) {
    return { ok: false, message: "The social link could not be saved." };
  }

  const supabase = await createClient();
  if (!(await hasVenueAccess(supabase, venueId))) {
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
    .from("venue_socials")
    .select("id, platform, is_primary")
    .eq("venue_id", venueId);

  if (existingError) {
    return { ok: false, message: "The social link could not be saved." };
  }

  if (
    existing?.some((social) => social.platform === validated.value.platform)
  ) {
    return {
      ok: false,
      message: "This platform is already linked to the venue.",
      fieldErrors: { platform: "Choose an unused platform." },
    };
  }

  const supportedCount = (existing ?? []).filter((social) =>
    isVenueSocialPlatform(social.platform)
  ).length;
  if (supportedCount >= MAX_VENUE_SOCIALS) {
    return {
      ok: false,
      message: "This venue already has all six supported social links.",
    };
  }

  const currentPrimary =
    existing?.find((social) => social.is_primary) ?? null;
  const shouldBePrimary =
    (existing?.length ?? 0) === 0 || validated.value.isPrimary;

  if (shouldBePrimary && currentPrimary) {
    const { data: cleared, error: clearError } = await supabase
      .from("venue_socials")
      .update({ is_primary: false })
      .eq("id", currentPrimary.id)
      .eq("venue_id", venueId)
      .select("id")
      .maybeSingle();
    if (clearError || !cleared) {
      return { ok: false, message: "The social link could not be saved." };
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("venue_socials")
    .insert({
      venue_id: venueId,
      platform: validated.value.platform,
      url: validated.value.url,
      is_primary: shouldBePrimary,
    })
    .select("id")
    .maybeSingle();

  if (insertError || !inserted) {
    if (shouldBePrimary && currentPrimary) {
      await restorePrimary(supabase, venueId, currentPrimary.id);
    }
    return { ok: false, message: "The social link could not be saved." };
  }

  revalidateVenueSocials(venueId);
  return { ok: true, message: "Social link added." };
}

export async function updateVenueSocialAction(
  venueId: string,
  socialId: string,
  input: VenueSocialInput
): Promise<VenueSocialActionResult> {
  if (!isValidVenueId(venueId) || !isValidVenueSocialId(socialId)) {
    return { ok: false, message: "The social link could not be updated." };
  }

  const supabase = await createClient();
  if (!(await hasVenueAccess(supabase, venueId))) {
    return { ok: false, message: "The social link could not be updated." };
  }

  const { data: target, error: targetError } = await supabase
    .from("venue_socials")
    .select("id, venue_id, platform, url, is_primary, created_at")
    .eq("id", socialId)
    .eq("venue_id", venueId)
    .maybeSingle();

  if (targetError || !target) {
    return { ok: false, message: "The social link could not be updated." };
  }
  if (!isVenueSocialPlatform(target.platform)) {
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

  const { data: venueSocials, error: socialsError } = await supabase
    .from("venue_socials")
    .select("id, platform, is_primary")
    .eq("venue_id", venueId);

  if (socialsError) {
    return { ok: false, message: "The social link could not be updated." };
  }

  if (
    venueSocials?.some(
      (social) =>
        String(social.id) !== socialId &&
        social.platform === validated.value.platform
    )
  ) {
    return {
      ok: false,
      message: "This platform is already linked to the venue.",
      fieldErrors: { platform: "Choose an unused platform." },
    };
  }

  const currentPrimary =
    venueSocials?.find(
      (social) =>
        social.is_primary && String(social.id) !== String(target.id)
    ) ?? null;
  const needsPrimarySwitch =
    validated.value.isPrimary && !target.is_primary && currentPrimary;

  if (needsPrimarySwitch) {
    const { data: cleared, error: clearError } = await supabase
      .from("venue_socials")
      .update({ is_primary: false })
      .eq("id", currentPrimary.id)
      .eq("venue_id", venueId)
      .select("id")
      .maybeSingle();
    if (clearError || !cleared) {
      return { ok: false, message: "The social link could not be updated." };
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from("venue_socials")
    .update({
      platform: validated.value.platform,
      url: validated.value.url,
      is_primary: validated.value.isPrimary,
    })
    .eq("id", socialId)
    .eq("venue_id", venueId)
    .select("id")
    .maybeSingle();

  if (updateError || !updated) {
    if (needsPrimarySwitch) {
      await restorePrimary(supabase, venueId, currentPrimary.id);
    }
    return { ok: false, message: "The social link could not be updated." };
  }

  revalidateVenueSocials(venueId);
  return { ok: true, message: "Social link updated." };
}

export async function setPrimaryVenueSocialAction(
  venueId: string,
  socialId: string
): Promise<VenueSocialActionResult> {
  if (!isValidVenueId(venueId) || !isValidVenueSocialId(socialId)) {
    return { ok: false, message: "The social link could not be updated." };
  }

  const supabase = await createClient();
  if (!(await hasVenueAccess(supabase, venueId))) {
    return { ok: false, message: "The social link could not be updated." };
  }

  const { data: target, error: targetError } = await supabase
    .from("venue_socials")
    .select("id, platform, is_primary")
    .eq("id", socialId)
    .eq("venue_id", venueId)
    .maybeSingle();

  if (
    targetError ||
    !target ||
    !isVenueSocialPlatform(target.platform)
  ) {
    return { ok: false, message: "The social link could not be updated." };
  }
  if (target.is_primary) {
    return { ok: true, message: "This is already the primary social link." };
  }

  const { data: currentPrimary, error: primaryError } = await supabase
    .from("venue_socials")
    .select("id")
    .eq("venue_id", venueId)
    .eq("is_primary", true)
    .maybeSingle();

  if (primaryError) {
    return { ok: false, message: "The social link could not be updated." };
  }

  if (currentPrimary) {
    const { data: cleared, error: clearError } = await supabase
      .from("venue_socials")
      .update({ is_primary: false })
      .eq("id", currentPrimary.id)
      .eq("venue_id", venueId)
      .select("id")
      .maybeSingle();
    if (clearError || !cleared) {
      return { ok: false, message: "The social link could not be updated." };
    }
  }

  const { data: selected, error: selectError } = await supabase
    .from("venue_socials")
    .update({ is_primary: true })
    .eq("id", socialId)
    .eq("venue_id", venueId)
    .select("id")
    .maybeSingle();

  if (selectError || !selected) {
    if (currentPrimary) {
      await restorePrimary(supabase, venueId, currentPrimary.id);
    }
    return { ok: false, message: "The social link could not be updated." };
  }

  revalidateVenueSocials(venueId);
  return { ok: true, message: "Primary social link updated." };
}

export async function deleteVenueSocialAction(
  venueId: string,
  socialId: string
): Promise<VenueSocialActionResult> {
  if (!isValidVenueId(venueId) || !isValidVenueSocialId(socialId)) {
    return { ok: false, message: "The social link could not be deleted." };
  }

  const supabase = await createClient();
  if (!(await hasVenueAccess(supabase, venueId))) {
    return { ok: false, message: "The social link could not be deleted." };
  }

  const { data: target, error: targetError } = await supabase
    .from("venue_socials")
    .select("id")
    .eq("id", socialId)
    .eq("venue_id", venueId)
    .maybeSingle();

  if (targetError || !target) {
    return { ok: false, message: "The social link could not be deleted." };
  }

  const { data: deleted, error: deleteError } = await supabase
    .from("venue_socials")
    .delete()
    .eq("id", socialId)
    .eq("venue_id", venueId)
    .select("id")
    .maybeSingle();

  if (deleteError || !deleted) {
    return { ok: false, message: "The social link could not be deleted." };
  }

  revalidateVenueSocials(venueId);
  return { ok: true, message: "Social link deleted." };
}
