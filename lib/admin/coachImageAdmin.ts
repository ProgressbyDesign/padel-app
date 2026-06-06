import type { SupabaseClient } from "@supabase/supabase-js";

const COACH_IMAGES_BUCKET = "coach-images";

export function coachImageStoragePublicUrl(storagePath: string): string {
  const base =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "https://uebhforyugmvpqvkzrbt.supabase.co";
  const path = storagePath.replace(/^\/+/, "");
  return `${base}/storage/v1/object/public/${COACH_IMAGES_BUCKET}/${path}`;
}

export function slugifyCoachImageBase(name: string | null, slug: string | null, coachId: string): string {
  const raw = (slug?.trim() || name?.trim() || coachId).toLowerCase();
  const normalized = raw
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return normalized || "coach";
}

export async function coachHasPrimaryImage(db: SupabaseClient, coachId: string): Promise<boolean> {
  const { data } = await db
    .from("coach_images")
    .select("id")
    .eq("coach_id", coachId)
    .eq("is_primary", true)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export async function syncCoachImageUrlFromPrimary(db: SupabaseClient, coachId: string): Promise<void> {
  const { data: primary } = await db
    .from("coach_images")
    .select("image_url")
    .eq("coach_id", coachId)
    .eq("is_primary", true)
    .maybeSingle();
  if (primary?.image_url?.trim()) {
    await db.from("coaches").update({ image_url: primary.image_url.trim() }).eq("id", coachId);
    return;
  }
  const { data: first } = await db
    .from("coach_images")
    .select("image_url")
    .eq("coach_id", coachId)
    .limit(1)
    .maybeSingle();
  if (first?.image_url?.trim()) {
    await db.from("coaches").update({ image_url: first.image_url.trim() }).eq("id", coachId);
  }
}

export async function promoteNextPrimaryCoachImage(db: SupabaseClient, coachId: string): Promise<void> {
  const { data: next } = await db
    .from("coach_images")
    .select("id, image_url")
    .eq("coach_id", coachId)
    .limit(1)
    .maybeSingle();
  if (!next) return;
  await db.from("coach_images").update({ is_primary: false }).eq("coach_id", coachId);
  await db.from("coach_images").update({ is_primary: true }).eq("id", next.id);
  if (next.image_url?.trim()) {
    await db.from("coaches").update({ image_url: next.image_url.trim() }).eq("id", coachId);
  }
}

export async function insertCoachImageIfNew(
  db: SupabaseClient,
  coachId: string,
  imageUrl: string
): Promise<{ ok: true; created: boolean } | { ok: false; message: string }> {
  const url = imageUrl.trim();
  if (!url) return { ok: false, message: "Image URL is required." };
  const { data: existing } = await db
    .from("coach_images")
    .select("id")
    .eq("coach_id", coachId)
    .eq("image_url", url)
    .maybeSingle();
  if (existing) {
    return { ok: false, message: "This image URL is already linked to this coach." };
  }
  const hasPrimary = await coachHasPrimaryImage(db, coachId);
  const { error } = await db.from("coach_images").insert({
    coach_id: coachId,
    image_url: url,
    is_primary: !hasPrimary,
  });
  if (error) return { ok: false, message: error.message };
  if (!hasPrimary) await syncCoachImageUrlFromPrimary(db, coachId);
  return { ok: true, created: true };
}

export { COACH_IMAGES_BUCKET };