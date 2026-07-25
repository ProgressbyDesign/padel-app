"use server";

import { revalidatePath } from "next/cache";
import { isValidCoachId } from "@/lib/queries/managedCoachShell";
import { createClient } from "@/lib/supabase/server";
import {
  managedCoachImageStoragePathFromUrl,
  isManagedCoachImageStoragePath,
  MAX_COACH_IMAGES,
  COACH_IMAGES_BUCKET,
  type CoachImageRow,
} from "@/lib/coachImages";

export type CoachImageActionResult =
  | { ok: true; message: string; warning?: string }
  | { ok: false; message: string };

type UserSupabaseClient = Awaited<ReturnType<typeof createClient>>;

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

async function removeManagedObject(
  supabase: UserSupabaseClient,
  storagePath: string
): Promise<boolean> {
  const { error } = await supabase.storage
    .from(COACH_IMAGES_BUCKET)
    .remove([storagePath]);
  return !error;
}

async function syncCoachLegacyImageUrl(
  supabase: UserSupabaseClient,
  coachId: string,
  imageUrl: string | null
) {
  await supabase
    .from("coaches")
    .update({ image_url: imageUrl })
    .eq("id", coachId);
}

function revalidateCoachImages(coachId: string) {
  revalidatePath(`/account/coaches/${coachId}`);
  revalidatePath(`/account/coaches/${coachId}/images`);
  revalidatePath(`/coach/${coachId}`);
  revalidatePath("/coaches");
  revalidatePath("/account");
}

export async function registerCoachImageAction(
  coachId: string,
  storagePath: string
): Promise<CoachImageActionResult> {
  if (
    !isValidCoachId(coachId) ||
    !isManagedCoachImageStoragePath(storagePath, coachId)
  ) {
    return { ok: false, message: "The uploaded image could not be registered." };
  }

  const supabase = await createClient();
  if (!(await hasCoachAccess(supabase, coachId))) {
    await removeManagedObject(supabase, storagePath);
    return { ok: false, message: "The uploaded image could not be registered." };
  }

  const { data: existing, error: existingError } = await supabase
    .from("coach_images")
    .select("id, is_primary")
    .eq("coach_id", coachId);

  if (existingError || (existing?.length ?? 0) >= MAX_COACH_IMAGES) {
    await removeManagedObject(supabase, storagePath);
    return {
      ok: false,
      message:
        existing?.length && existing.length >= MAX_COACH_IMAGES
          ? "This coach already has the maximum number of images."
          : "The uploaded image could not be registered.",
    };
  }

  const { data: publicUrlData } = supabase.storage
    .from(COACH_IMAGES_BUCKET)
    .getPublicUrl(storagePath);
  const publicUrl = publicUrlData.publicUrl?.trim();
  if (!publicUrl) {
    await removeManagedObject(supabase, storagePath);
    return { ok: false, message: "The uploaded image could not be registered." };
  }

  const makePrimary = (existing?.length ?? 0) === 0;
  const { error: insertError } = await supabase.from("coach_images").insert({
    coach_id: coachId,
    image_url: publicUrl,
    is_primary: makePrimary,
  });

  if (insertError) {
    await removeManagedObject(supabase, storagePath);
    if (insertError.code === "23505") {
      return { ok: false, message: "This image is already on the profile." };
    }
    return { ok: false, message: "The uploaded image could not be registered." };
  }

  if (makePrimary) {
    await syncCoachLegacyImageUrl(supabase, coachId, publicUrl);
  }

  revalidateCoachImages(coachId);
  return { ok: true, message: "Image uploaded." };
}

export async function setPrimaryCoachImageAction(
  coachId: string,
  imageId: string
): Promise<CoachImageActionResult> {
  if (!isValidCoachId(coachId) || !isValidCoachId(imageId)) {
    return { ok: false, message: "The image could not be updated." };
  }

  const supabase = await createClient();
  if (!(await hasCoachAccess(supabase, coachId))) {
    return { ok: false, message: "The image could not be updated." };
  }

  const { data: target, error: targetError } = await supabase
    .from("coach_images")
    .select("id, coach_id, image_url, is_primary, created_at")
    .eq("id", imageId)
    .eq("coach_id", coachId)
    .maybeSingle();

  if (targetError || !target) {
    return { ok: false, message: "The image could not be updated." };
  }
  if (target.is_primary) {
    return { ok: true, message: "This is already the primary image." };
  }

  const { data: currentPrimary, error: primaryError } = await supabase
    .from("coach_images")
    .select("id")
    .eq("coach_id", coachId)
    .eq("is_primary", true)
    .maybeSingle();

  if (primaryError) {
    return { ok: false, message: "The image could not be updated." };
  }

  if (currentPrimary) {
    const { error: clearError } = await supabase
      .from("coach_images")
      .update({ is_primary: false })
      .eq("id", currentPrimary.id)
      .eq("coach_id", coachId);
    if (clearError) {
      return { ok: false, message: "The image could not be updated." };
    }
  }

  const { data: selected, error: selectError } = await supabase
    .from("coach_images")
    .update({ is_primary: true })
    .eq("id", imageId)
    .eq("coach_id", coachId)
    .select("id, image_url")
    .maybeSingle();

  if (selectError || !selected) {
    if (currentPrimary) {
      await supabase
        .from("coach_images")
        .update({ is_primary: true })
        .eq("id", currentPrimary.id)
        .eq("coach_id", coachId);
    }
    return { ok: false, message: "The image could not be updated." };
  }

  await syncCoachLegacyImageUrl(supabase, coachId, selected.image_url);
  revalidateCoachImages(coachId);
  return { ok: true, message: "Primary image updated." };
}

export async function deleteCoachImageAction(
  coachId: string,
  imageId: string
): Promise<CoachImageActionResult> {
  if (!isValidCoachId(coachId) || !isValidCoachId(imageId)) {
    return { ok: false, message: "The image could not be deleted." };
  }

  const supabase = await createClient();
  if (!(await hasCoachAccess(supabase, coachId))) {
    return { ok: false, message: "The image could not be deleted." };
  }

  const { data: image, error: imageError } = await supabase
    .from("coach_images")
    .select("id, coach_id, image_url, is_primary, created_at")
    .eq("id", imageId)
    .eq("coach_id", coachId)
    .maybeSingle();

  if (imageError || !image) {
    return { ok: false, message: "The image could not be deleted." };
  }

  let promotedImage: Pick<CoachImageRow, "id" | "image_url"> | null = null;
  if (image.is_primary) {
    const { data: nextImage, error: nextError } = await supabase
      .from("coach_images")
      .select("id, image_url")
      .eq("coach_id", coachId)
      .neq("id", imageId)
      .order("created_at", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextError) {
      return { ok: false, message: "The image could not be deleted." };
    }

    if (nextImage) {
      const { error: clearError } = await supabase
        .from("coach_images")
        .update({ is_primary: false })
        .eq("id", imageId)
        .eq("coach_id", coachId);
      if (clearError) {
        return { ok: false, message: "The image could not be deleted." };
      }

      const { data: promoted, error: promoteError } = await supabase
        .from("coach_images")
        .update({ is_primary: true })
        .eq("id", nextImage.id)
        .eq("coach_id", coachId)
        .select("id, image_url")
        .maybeSingle();

      if (promoteError || !promoted) {
        await supabase
          .from("coach_images")
          .update({ is_primary: true })
          .eq("id", imageId)
          .eq("coach_id", coachId);
        return { ok: false, message: "The image could not be deleted." };
      }
      promotedImage = {
        id: String(promoted.id),
        image_url: String(promoted.image_url),
      };
    }
  }

  const { data: deleted, error: deleteError } = await supabase
    .from("coach_images")
    .delete()
    .eq("id", imageId)
    .eq("coach_id", coachId)
    .select("id")
    .maybeSingle();

  if (deleteError || !deleted) {
    if (promotedImage) {
      await supabase
        .from("coach_images")
        .update({ is_primary: false })
        .eq("id", promotedImage.id)
        .eq("coach_id", coachId);
      await supabase
        .from("coach_images")
        .update({ is_primary: true })
        .eq("id", imageId)
        .eq("coach_id", coachId);
    }
    return { ok: false, message: "The image could not be deleted." };
  }

  if (promotedImage) {
    await syncCoachLegacyImageUrl(supabase, coachId, promotedImage.image_url);
  } else if (image.is_primary) {
    await syncCoachLegacyImageUrl(supabase, coachId, null);
  }

  revalidateCoachImages(coachId);

  const managedPath = managedCoachImageStoragePathFromUrl(
    image.image_url,
    coachId
  );
  if (!managedPath) {
    return {
      ok: true,
      message: "Image removed from the coach gallery.",
      warning:
        "This imported image used a legacy path, so its original Storage object was left unchanged.",
    };
  }

  if (!(await removeManagedObject(supabase, managedPath))) {
    return {
      ok: true,
      message: "Image removed from the coach gallery.",
      warning:
        "The managed Storage object could not be cleaned up automatically.",
    };
  }

  return { ok: true, message: "Image deleted." };
}
