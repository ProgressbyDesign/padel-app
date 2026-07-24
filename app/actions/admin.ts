"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, getAdminSecret, isAdminAuthenticated } from "@/lib/admin/auth";
import {
  COACH_IMAGES_BUCKET,
  coachImageStoragePublicUrl,
  insertCoachImageIfNew,
  promoteNextPrimaryCoachImage,
  slugifyCoachImageBase,
  syncCoachImageUrlFromPrimary,
} from "@/lib/admin/coachImageAdmin";
import { searchVenuesForAdmin } from "@/lib/admin/queries";
import { DATA_QUALITY_OPTIONS, type DataQualityStatus } from "@/lib/admin/types";
import { normalizeCoachImageUrl } from "@/lib/coachImageResolve";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type AdminActionResult = { ok: true } | { ok: false; message: string };

async function requireAdmin(): Promise<string | null> {
  if (!(await isAdminAuthenticated())) {
    return "Not authenticated.";
  }
  return null;
}

function isDataQuality(v: string): v is DataQualityStatus {
  return (DATA_QUALITY_OPTIONS as readonly string[]).includes(v);
}

function revalidateAdmin(...paths: string[]) {
  for (const p of paths) revalidatePath(p);
}

export async function adminLogin(password: string): Promise<AdminActionResult> {
  const secret = getAdminSecret();
  if (!secret) {
    return { ok: false, message: "ADMIN_SECRET is not configured on the server." };
  }
  if (password.trim() !== secret) {
    return { ok: false, message: "Invalid password." };
  }
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return { ok: true };
}

export async function searchVenuesAdminAction(term: string): Promise<
  | { ok: true; venues: { id: string; name: string; city: string | null; country: string | null; website: string | null }[] }
  | { ok: false; message: string }
> {
  const authErr = await requireAdmin();
  if (authErr) return { ok: false, message: authErr };
  try {
    const venues = await searchVenuesForAdmin(term);
    return { ok: true, venues };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Search failed" };
  }
}

export async function adminLogout(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  redirect("/admin/data-quality/login");
}

export async function updateVenueAdmin(
  venueId: string,
  payload: {
    name: string;
    description: string;
    courts: string;
    court_type: string;
    venue_type: string;
    coaching_available: boolean;
    coaching_description: string;
    price: string;
    is_approved: boolean;
    data_quality_status: string;
  }
): Promise<AdminActionResult> {
  const authErr = await requireAdmin();
  if (authErr) return { ok: false, message: authErr };

  const status = payload.data_quality_status.trim();
  if (!isDataQuality(status)) {
    return { ok: false, message: "Invalid data quality status." };
  }

  const courtsNum = payload.courts.trim() ? Number(payload.courts) : null;
  if (payload.courts.trim() && Number.isNaN(courtsNum)) {
    return { ok: false, message: "Courts must be a number." };
  }

  const db = getSupabaseAdmin();
  const { error } = await db
    .from("venues")
    .update({
      name: payload.name.trim() || null,
      description: payload.description.trim() || null,
      courts: courtsNum,
      court_type: payload.court_type.trim() || null,
      venue_type: payload.venue_type.trim() || null,
      coaching_available: payload.coaching_available,
      coaching_description: payload.coaching_description.trim() || null,
      price: payload.price.trim() || null,
      is_approved: payload.is_approved,
      data_quality_status: status,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", venueId);

  if (error) return { ok: false, message: error.message };
  revalidateAdmin("/admin/data-quality/venues", `/admin/data-quality/venues/${venueId}`, "/admin/data-quality", "/admin/data-quality/review-queue");
  return { ok: true };
}

export async function upsertVenueSocialAdmin(payload: {
  id?: string;
  venue_id: string;
  platform: string;
  url: string;
  is_primary: boolean;
}): Promise<AdminActionResult> {
  const authErr = await requireAdmin();
  if (authErr) return { ok: false, message: authErr };

  const platform = payload.platform.trim();
  const url = payload.url.trim();
  if (!platform || !url) return { ok: false, message: "Platform and URL are required." };

  const db = getSupabaseAdmin();
  if (payload.is_primary) {
    await db.from("venue_socials").update({ is_primary: false }).eq("venue_id", payload.venue_id);
  }

  if (payload.id) {
    const { error } = await db
      .from("venue_socials")
      .update({ platform, url, is_primary: payload.is_primary })
      .eq("id", payload.id);
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await db.from("venue_socials").insert({
      venue_id: payload.venue_id,
      platform,
      url,
      is_primary: payload.is_primary,
    });
    if (error) return { ok: false, message: error.message };
  }

  revalidateAdmin(`/admin/data-quality/venues/${payload.venue_id}`);
  return { ok: true };
}

export async function deleteVenueSocialAdmin(id: string, venueId: string): Promise<AdminActionResult> {
  const authErr = await requireAdmin();
  if (authErr) return { ok: false, message: authErr };
  const { error } = await getSupabaseAdmin().from("venue_socials").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateAdmin(`/admin/data-quality/venues/${venueId}`);
  return { ok: true };
}

export async function updateCoachAdmin(
  coachId: string,
  payload: {
    name: string;
    role: string;
    description: string;
    level: string;
    experience_years: string;
    price_from: string;
    email: string;
    phone: string;
    image_url: string;
    is_approved: boolean;
    data_quality_status: string;
  }
): Promise<AdminActionResult> {
  const authErr = await requireAdmin();
  if (authErr) return { ok: false, message: authErr };

  const status = payload.data_quality_status.trim();
  if (!isDataQuality(status)) {
    return { ok: false, message: "Invalid data quality status." };
  }

  const years = payload.experience_years.trim() ? Number(payload.experience_years) : null;
  if (payload.experience_years.trim() && Number.isNaN(years)) {
    return { ok: false, message: "Experience years must be a number." };
  }

  const { error } = await getSupabaseAdmin()
    .from("coaches")
    .update({
      name: payload.name.trim() || null,
      role: payload.role.trim() || null,
      description: payload.description.trim() || null,
      level: payload.level.trim() || null,
      experience_years: years,
      price_from: payload.price_from.trim() || null,
      email: payload.email.trim() || null,
      phone: payload.phone.trim() || null,
      image_url: payload.image_url.trim() || null,
      is_approved: payload.is_approved,
      data_quality_status: status,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", coachId);

  if (error) return { ok: false, message: error.message };
  revalidateAdmin("/admin/data-quality/coaches", `/admin/data-quality/coaches/${coachId}`, "/admin/data-quality", "/admin/data-quality/review-queue");
  return { ok: true };
}

export async function linkCoachVenuesAdmin(
  coachId: string,
  venueIds: string[],
  primaryVenueId?: string | null
): Promise<AdminActionResult> {
  const authErr = await requireAdmin();
  if (authErr) return { ok: false, message: authErr };

  const unique = [...new Set(venueIds.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return { ok: false, message: "Select at least one venue." };

  const db = getSupabaseAdmin();
  const rows = unique.map((venue_id) => ({
    coach_id: coachId,
    venue_id,
    is_primary: primaryVenueId ? venue_id === primaryVenueId : false,
  }));

  if (primaryVenueId && unique.includes(primaryVenueId)) {
    await db.from("coach_venues").update({ is_primary: false }).eq("coach_id", coachId);
  }

  for (const row of rows) {
    const { data: existing, error: findErr } = await db
      .from("coach_venues")
      .select("coach_id")
      .eq("coach_id", row.coach_id)
      .eq("venue_id", row.venue_id)
      .maybeSingle();
    if (findErr) return { ok: false, message: findErr.message };

    if (existing) {
      const { error } = await db
        .from("coach_venues")
        .update({ is_primary: row.is_primary })
        .eq("coach_id", row.coach_id)
        .eq("venue_id", row.venue_id);
      if (error) return { ok: false, message: error.message };
    } else {
      const { error } = await db.from("coach_venues").insert(row);
      if (error) return { ok: false, message: error.message };
    }
  }
  revalidateAdmin(
    "/admin/data-quality/coach-venue-links",
    `/admin/data-quality/coaches/${coachId}`,
    "/admin/data-quality/coaches",
    "/admin/data-quality",
    "/admin/data-quality/review-queue"
  );
  return { ok: true };
}

export async function unlinkCoachVenueAdmin(
  coachId: string,
  venueId: string
): Promise<AdminActionResult> {
  const authErr = await requireAdmin();
  if (authErr) return { ok: false, message: authErr };
  const { error } = await getSupabaseAdmin()
    .from("coach_venues")
    .delete()
    .eq("coach_id", coachId)
    .eq("venue_id", venueId);
  if (error) return { ok: false, message: error.message };
  revalidateAdmin(`/admin/data-quality/coaches/${coachId}`, "/admin/data-quality/coach-venue-links");
  return { ok: true };
}

export async function upsertCoachOutcomeAdmin(payload: {
  id?: string;
  coach_id: string;
  outcome: string;
}): Promise<AdminActionResult> {
  const authErr = await requireAdmin();
  if (authErr) return { ok: false, message: authErr };
  const outcome = payload.outcome.trim();
  if (!outcome) return { ok: false, message: "Outcome text is required." };
  const db = getSupabaseAdmin();
  if (payload.id) {
    const { error } = await db.from("coach_outcomes").update({ outcome }).eq("id", payload.id);
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await db.from("coach_outcomes").insert({ coach_id: payload.coach_id, outcome });
    if (error) return { ok: false, message: error.message };
  }
  revalidateAdmin(`/admin/data-quality/coaches/${payload.coach_id}`);
  return { ok: true };
}

export async function deleteCoachOutcomeAdmin(
  id: string,
  coachId: string
): Promise<AdminActionResult> {
  const authErr = await requireAdmin();
  if (authErr) return { ok: false, message: authErr };
  const { error } = await getSupabaseAdmin().from("coach_outcomes").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateAdmin(`/admin/data-quality/coaches/${coachId}`);
  return { ok: true };
}

export async function upsertCoachSocialAdmin(payload: {
  id?: string;
  coach_id: string;
  platform: string;
  url: string;
  is_primary: boolean;
}): Promise<AdminActionResult> {
  const authErr = await requireAdmin();
  if (authErr) return { ok: false, message: authErr };
  const platform = payload.platform.trim();
  const url = payload.url.trim();
  if (!platform || !url) return { ok: false, message: "Platform and URL are required." };
  const db = getSupabaseAdmin();
  if (payload.is_primary) {
    await db.from("coach_socials").update({ is_primary: false }).eq("coach_id", payload.coach_id);
  }
  if (payload.id) {
    const { error } = await db
      .from("coach_socials")
      .update({ platform, url, is_primary: payload.is_primary })
      .eq("id", payload.id);
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await db.from("coach_socials").insert({
      coach_id: payload.coach_id,
      platform,
      url,
      is_primary: payload.is_primary,
    });
    if (error) return { ok: false, message: error.message };
  }
  revalidateAdmin(`/admin/data-quality/coaches/${payload.coach_id}`);
  return { ok: true };
}

export async function deleteCoachSocialAdmin(
  id: string,
  coachId: string
): Promise<AdminActionResult> {
  const authErr = await requireAdmin();
  if (authErr) return { ok: false, message: authErr };
  const { error } = await getSupabaseAdmin().from("coach_socials").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateAdmin(`/admin/data-quality/coaches/${coachId}`);
  return { ok: true };
}

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_COACH_IMAGE_BYTES = 5 * 1024 * 1024;

export async function addCoachImageUrlAdmin(
  coachId: string,
  imageUrl: string
): Promise<AdminActionResult> {
  const authErr = await requireAdmin();
  if (authErr) return { ok: false, message: authErr };

  const url = normalizeCoachImageUrl(imageUrl);
  if (!url) return { ok: false, message: "Image URL is required." };
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, message: "Image URL must start with http:// or https://." };
  }

  const db = getSupabaseAdmin();
  const inserted = await insertCoachImageIfNew(db, coachId, url);
  if (!inserted.ok) return { ok: false, message: inserted.message };

  revalidateAdmin(`/admin/data-quality/coaches/${coachId}`, "/admin/data-quality/coaches");
  return { ok: true };
}

export async function uploadCoachImageAdmin(formData: FormData): Promise<AdminActionResult> {
  const authErr = await requireAdmin();
  if (authErr) return { ok: false, message: authErr };

  const coachId = String(formData.get("coachId") ?? "").trim();
  const file = formData.get("file");
  if (!coachId) return { ok: false, message: "Coach id is required." };
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose an image file to upload." };
  }
  if (file.size > MAX_COACH_IMAGE_BYTES) {
    return { ok: false, message: "Image must be 5 MB or smaller." };
  }
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_IMAGE_TYPES.has(mime)) {
    return { ok: false, message: "Use JPEG, PNG, WebP, or GIF." };
  }

  const db = getSupabaseAdmin();
  const { data: coach, error: coachErr } = await db
    .from("coaches")
    .select("id, name, slug")
    .eq("id", coachId)
    .maybeSingle();
  if (coachErr) return { ok: false, message: coachErr.message };
  if (!coach) return { ok: false, message: "Coach not found." };

  const ext =
    mime === "image/png"
      ? "png"
      : mime === "image/webp"
        ? "webp"
        : mime === "image/gif"
          ? "gif"
          : "jpg";
  const base = slugifyCoachImageBase(coach.name, coach.slug, coachId);
  const storagePath = `${base}-${Date.now()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadErr } = await db.storage.from(COACH_IMAGES_BUCKET).upload(storagePath, buffer, {
    contentType: mime,
    upsert: false,
  });
  if (uploadErr) {
    return {
      ok: false,
      message: uploadErr.message.includes("Bucket not found")
        ? `Storage bucket "${COACH_IMAGES_BUCKET}" is missing. Create it in Supabase Storage (public read).`
        : uploadErr.message,
    };
  }

  const publicUrl = coachImageStoragePublicUrl(storagePath);
  const inserted = await insertCoachImageIfNew(db, coachId, publicUrl);
  if (!inserted.ok) {
    return { ok: false, message: inserted.message };
  }

  revalidateAdmin(`/admin/data-quality/coaches/${coachId}`, "/admin/data-quality/coaches");
  return { ok: true };
}

export async function setPrimaryCoachImageAdmin(
  coachId: string,
  imageId: string
): Promise<AdminActionResult> {
  const authErr = await requireAdmin();
  if (authErr) return { ok: false, message: authErr };
  const db = getSupabaseAdmin();

  const { data: row, error: fetchErr } = await db
    .from("coach_images")
    .select("image_url")
    .eq("id", imageId)
    .eq("coach_id", coachId)
    .maybeSingle();
  if (fetchErr) return { ok: false, message: fetchErr.message };
  if (!row) return { ok: false, message: "Image not found." };

  await db.from("coach_images").update({ is_primary: false }).eq("coach_id", coachId);
  const { error } = await db
    .from("coach_images")
    .update({ is_primary: true })
    .eq("id", imageId)
    .eq("coach_id", coachId);
  if (error) return { ok: false, message: error.message };

  if (row.image_url?.trim()) {
    await db.from("coaches").update({ image_url: row.image_url.trim() }).eq("id", coachId);
  }

  revalidateAdmin(`/admin/data-quality/coaches/${coachId}`, "/admin/data-quality/coaches");
  return { ok: true };
}

export async function deleteCoachImageAdmin(
  id: string,
  coachId: string
): Promise<AdminActionResult> {
  const authErr = await requireAdmin();
  if (authErr) return { ok: false, message: authErr };
  const db = getSupabaseAdmin();

  const { data: row, error: fetchErr } = await db
    .from("coach_images")
    .select("is_primary")
    .eq("id", id)
    .eq("coach_id", coachId)
    .maybeSingle();
  if (fetchErr) return { ok: false, message: fetchErr.message };
  if (!row) return { ok: false, message: "Image not found." };

  const wasPrimary = row.is_primary === true;
  const { error } = await db.from("coach_images").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };

  if (wasPrimary) {
    await promoteNextPrimaryCoachImage(db, coachId);
  } else {
    await syncCoachImageUrlFromPrimary(db, coachId);
  }

  revalidateAdmin(`/admin/data-quality/coaches/${coachId}`, "/admin/data-quality/coaches");
  return { ok: true };
}
