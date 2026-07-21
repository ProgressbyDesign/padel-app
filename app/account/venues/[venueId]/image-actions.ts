"use server";

import { revalidatePath } from "next/cache";
import { isValidVenueId } from "@/lib/queries/managedVenue";
import { createClient } from "@/lib/supabase/server";
import {
  managedVenueImageStoragePathFromUrl,
  isManagedVenueImageStoragePath,
  MAX_VENUE_IMAGES,
  VENUE_IMAGES_BUCKET,
  type VenueImageRow,
} from "@/lib/venueImages";

export type VenueImageActionResult =
  | { ok: true; message: string; warning?: string }
  | { ok: false; message: string };

type UserSupabaseClient = Awaited<ReturnType<typeof createClient>>;

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

async function removeManagedObject(
  supabase: UserSupabaseClient,
  storagePath: string
): Promise<boolean> {
  const { error } = await supabase.storage
    .from(VENUE_IMAGES_BUCKET)
    .remove([storagePath]);
  return !error;
}

function revalidateVenueImages(venueId: string) {
  revalidatePath(`/account/venues/${venueId}`);
  revalidatePath(`/account/venues/${venueId}/images`);
  revalidatePath(`/venue/${venueId}`);
  revalidatePath("/venues");
}

export async function registerVenueImageAction(
  venueId: string,
  storagePath: string
): Promise<VenueImageActionResult> {
  if (
    !isValidVenueId(venueId) ||
    !isManagedVenueImageStoragePath(storagePath, venueId)
  ) {
    return { ok: false, message: "The uploaded image could not be registered." };
  }

  const supabase = await createClient();
  if (!(await hasVenueAccess(supabase, venueId))) {
    await removeManagedObject(supabase, storagePath);
    return { ok: false, message: "The uploaded image could not be registered." };
  }

  const { data: existing, error: existingError } = await supabase
    .from("venue_images")
    .select("id, is_primary")
    .eq("venue_id", venueId);

  if (existingError || (existing?.length ?? 0) >= MAX_VENUE_IMAGES) {
    await removeManagedObject(supabase, storagePath);
    return {
      ok: false,
      message:
        existing?.length && existing.length >= MAX_VENUE_IMAGES
          ? "This venue already has the maximum number of images."
          : "The uploaded image could not be registered.",
    };
  }

  const { data: publicUrlData } = supabase.storage
    .from(VENUE_IMAGES_BUCKET)
    .getPublicUrl(storagePath);
  const publicUrl = publicUrlData.publicUrl?.trim();
  if (!publicUrl) {
    await removeManagedObject(supabase, storagePath);
    return { ok: false, message: "The uploaded image could not be registered." };
  }

  const { error: insertError } = await supabase.from("venue_images").insert({
    venue_id: venueId,
    url: publicUrl,
    is_primary: (existing?.length ?? 0) === 0,
  });

  if (insertError) {
    await removeManagedObject(supabase, storagePath);
    return { ok: false, message: "The uploaded image could not be registered." };
  }

  revalidateVenueImages(venueId);
  return { ok: true, message: "Image uploaded." };
}

export async function setPrimaryVenueImageAction(
  venueId: string,
  imageId: string
): Promise<VenueImageActionResult> {
  if (!isValidVenueId(venueId) || !isValidVenueId(imageId)) {
    return { ok: false, message: "The image could not be updated." };
  }

  const supabase = await createClient();
  if (!(await hasVenueAccess(supabase, venueId))) {
    return { ok: false, message: "The image could not be updated." };
  }

  const { data: target, error: targetError } = await supabase
    .from("venue_images")
    .select("id, venue_id, url, is_primary, created_at")
    .eq("id", imageId)
    .eq("venue_id", venueId)
    .maybeSingle();

  if (targetError || !target) {
    return { ok: false, message: "The image could not be updated." };
  }
  if (target.is_primary) {
    return { ok: true, message: "This is already the primary image." };
  }

  const { data: currentPrimary, error: primaryError } = await supabase
    .from("venue_images")
    .select("id")
    .eq("venue_id", venueId)
    .eq("is_primary", true)
    .maybeSingle();

  if (primaryError) {
    return { ok: false, message: "The image could not be updated." };
  }

  if (currentPrimary) {
    const { error: clearError } = await supabase
      .from("venue_images")
      .update({ is_primary: false })
      .eq("id", currentPrimary.id)
      .eq("venue_id", venueId);
    if (clearError) {
      return { ok: false, message: "The image could not be updated." };
    }
  }

  const { data: selected, error: selectError } = await supabase
    .from("venue_images")
    .update({ is_primary: true })
    .eq("id", imageId)
    .eq("venue_id", venueId)
    .select("id")
    .maybeSingle();

  if (selectError || !selected) {
    if (currentPrimary) {
      await supabase
        .from("venue_images")
        .update({ is_primary: true })
        .eq("id", currentPrimary.id)
        .eq("venue_id", venueId);
    }
    return { ok: false, message: "The image could not be updated." };
  }

  revalidateVenueImages(venueId);
  return { ok: true, message: "Primary image updated." };
}

export async function deleteVenueImageAction(
  venueId: string,
  imageId: string
): Promise<VenueImageActionResult> {
  if (!isValidVenueId(venueId) || !isValidVenueId(imageId)) {
    return { ok: false, message: "The image could not be deleted." };
  }

  const supabase = await createClient();
  if (!(await hasVenueAccess(supabase, venueId))) {
    return { ok: false, message: "The image could not be deleted." };
  }

  const { data: image, error: imageError } = await supabase
    .from("venue_images")
    .select("id, venue_id, url, is_primary, created_at")
    .eq("id", imageId)
    .eq("venue_id", venueId)
    .maybeSingle();

  if (imageError || !image) {
    return { ok: false, message: "The image could not be deleted." };
  }

  let promotedImage: Pick<VenueImageRow, "id"> | null = null;
  if (image.is_primary) {
    const { data: nextImage, error: nextError } = await supabase
      .from("venue_images")
      .select("id")
      .eq("venue_id", venueId)
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
        .from("venue_images")
        .update({ is_primary: false })
        .eq("id", imageId)
        .eq("venue_id", venueId);
      if (clearError) {
        return { ok: false, message: "The image could not be deleted." };
      }

      const { data: promoted, error: promoteError } = await supabase
        .from("venue_images")
        .update({ is_primary: true })
        .eq("id", nextImage.id)
        .eq("venue_id", venueId)
        .select("id")
        .maybeSingle();

      if (promoteError || !promoted) {
        await supabase
          .from("venue_images")
          .update({ is_primary: true })
          .eq("id", imageId)
          .eq("venue_id", venueId);
        return { ok: false, message: "The image could not be deleted." };
      }
      promotedImage = promoted;
    }
  }

  const { data: deleted, error: deleteError } = await supabase
    .from("venue_images")
    .delete()
    .eq("id", imageId)
    .eq("venue_id", venueId)
    .select("id")
    .maybeSingle();

  if (deleteError || !deleted) {
    if (promotedImage) {
      await supabase
        .from("venue_images")
        .update({ is_primary: false })
        .eq("id", promotedImage.id)
        .eq("venue_id", venueId);
      await supabase
        .from("venue_images")
        .update({ is_primary: true })
        .eq("id", imageId)
        .eq("venue_id", venueId);
    }
    return { ok: false, message: "The image could not be deleted." };
  }

  revalidateVenueImages(venueId);

  const managedPath = managedVenueImageStoragePathFromUrl(image.url, venueId);
  if (!managedPath) {
    return {
      ok: true,
      message: "Image removed from the venue gallery.",
      warning:
        "This imported image used a legacy path, so its original Storage object was left unchanged.",
    };
  }

  if (!(await removeManagedObject(supabase, managedPath))) {
    return {
      ok: true,
      message: "Image removed from the venue gallery.",
      warning:
        "The managed Storage object could not be cleaned up automatically.",
    };
  }

  return { ok: true, message: "Image deleted." };
}
