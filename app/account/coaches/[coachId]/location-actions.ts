"use server";

import { revalidatePath } from "next/cache";
import {
  isAllowedCoachLocationCountry,
  locationMutationErrorMessage,
  MAX_COACH_LOCATIONS,
  normalizeLocationCity,
  normalizeLocationCountry,
} from "@/lib/coachLocations";
import { isValidCoachId } from "@/lib/queries/managedCoachShell";
import { createClient } from "@/lib/supabase/server";

export type CoachLocationActionResult = {
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

function revalidateCoachLocationPaths(coachId: string) {
  revalidatePath(`/account/coaches/${coachId}`);
  revalidatePath(`/account/coaches/${coachId}/locations`);
  revalidatePath(`/coach/${coachId}`);
  revalidatePath("/coaches");
  revalidatePath("/account");
}

export async function createCoachLocation(
  coachId: string,
  input: { country: string; city: string; isPrimary?: boolean }
): Promise<CoachLocationActionResult> {
  const userId = await requireCoachMembership(coachId);
  if (!userId) {
    return { ok: false, message: "You do not have permission to edit this coach." };
  }

  const country = normalizeLocationCountry(input.country);
  const city = normalizeLocationCity(input.city);
  if (!isAllowedCoachLocationCountry(country)) {
    return { ok: false, message: "Choose a supported launch country." };
  }
  if (city.length < 2 || city.length > 80) {
    return { ok: false, message: "City must be between 2 and 80 characters." };
  }

  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase
    .from("coach_locations")
    .select("id, is_primary")
    .eq("coach_id", coachId);

  if (existingError) {
    return { ok: false, message: locationMutationErrorMessage(existingError) };
  }
  if ((existing?.length ?? 0) >= MAX_COACH_LOCATIONS) {
    return {
      ok: false,
      message: `You can add up to ${MAX_COACH_LOCATIONS} locations.`,
    };
  }

  const makePrimary = Boolean(input.isPrimary) || (existing?.length ?? 0) === 0;

  if (makePrimary && (existing?.length ?? 0) > 0) {
    const { error: clearError } = await supabase
      .from("coach_locations")
      .update({ is_primary: false })
      .eq("coach_id", coachId)
      .eq("is_primary", true);
    if (clearError) {
      return { ok: false, message: locationMutationErrorMessage(clearError) };
    }
  }

  const { error } = await supabase.from("coach_locations").insert({
    coach_id: coachId,
    country,
    city,
    is_primary: makePrimary,
  });

  if (error) {
    return { ok: false, message: locationMutationErrorMessage(error) };
  }

  revalidateCoachLocationPaths(coachId);
  return { ok: true, message: "Location added." };
}

export async function updateCoachLocation(
  coachId: string,
  locationId: string,
  input: { country: string; city: string }
): Promise<CoachLocationActionResult> {
  const userId = await requireCoachMembership(coachId);
  if (!userId || !isValidCoachId(locationId)) {
    return { ok: false, message: "You do not have permission to edit this coach." };
  }

  const country = normalizeLocationCountry(input.country);
  const city = normalizeLocationCity(input.city);
  if (!isAllowedCoachLocationCountry(country)) {
    return { ok: false, message: "Choose a supported launch country." };
  }
  if (city.length < 2 || city.length > 80) {
    return { ok: false, message: "City must be between 2 and 80 characters." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("coach_locations")
    .update({ country, city })
    .eq("id", locationId)
    .eq("coach_id", coachId);

  if (error) {
    return { ok: false, message: locationMutationErrorMessage(error) };
  }

  revalidateCoachLocationPaths(coachId);
  return { ok: true, message: "Location updated." };
}

export async function setPrimaryCoachLocation(
  coachId: string,
  locationId: string
): Promise<CoachLocationActionResult> {
  const userId = await requireCoachMembership(coachId);
  if (!userId || !isValidCoachId(locationId)) {
    return { ok: false, message: "You do not have permission to edit this coach." };
  }

  const supabase = await createClient();
  const { data: target, error: targetError } = await supabase
    .from("coach_locations")
    .select("id, is_primary")
    .eq("id", locationId)
    .eq("coach_id", coachId)
    .maybeSingle();

  if (targetError || !target) {
    return { ok: false, message: "Location not found." };
  }
  if (target.is_primary) {
    return { ok: true, message: "This is already the primary location." };
  }

  const { data: currentPrimary } = await supabase
    .from("coach_locations")
    .select("id")
    .eq("coach_id", coachId)
    .eq("is_primary", true)
    .maybeSingle();

  if (currentPrimary) {
    const { error: clearError } = await supabase
      .from("coach_locations")
      .update({ is_primary: false })
      .eq("id", currentPrimary.id)
      .eq("coach_id", coachId);
    if (clearError) {
      return { ok: false, message: locationMutationErrorMessage(clearError) };
    }
  }

  const { error: setError } = await supabase
    .from("coach_locations")
    .update({ is_primary: true })
    .eq("id", locationId)
    .eq("coach_id", coachId);

  if (setError) {
    if (currentPrimary) {
      await supabase
        .from("coach_locations")
        .update({ is_primary: true })
        .eq("id", currentPrimary.id)
        .eq("coach_id", coachId);
    }
    return { ok: false, message: locationMutationErrorMessage(setError) };
  }

  revalidateCoachLocationPaths(coachId);
  return { ok: true, message: "Primary location updated." };
}

export async function deleteCoachLocation(
  coachId: string,
  locationId: string
): Promise<CoachLocationActionResult> {
  const userId = await requireCoachMembership(coachId);
  if (!userId || !isValidCoachId(locationId)) {
    return { ok: false, message: "You do not have permission to edit this coach." };
  }

  const supabase = await createClient();
  const { data: target, error: targetError } = await supabase
    .from("coach_locations")
    .select("id, is_primary")
    .eq("id", locationId)
    .eq("coach_id", coachId)
    .maybeSingle();

  if (targetError || !target) {
    return { ok: false, message: "Location not found." };
  }

  const { error: deleteError } = await supabase
    .from("coach_locations")
    .delete()
    .eq("id", locationId)
    .eq("coach_id", coachId);

  if (deleteError) {
    return { ok: false, message: locationMutationErrorMessage(deleteError) };
  }

  if (target.is_primary) {
    const { data: next } = await supabase
      .from("coach_locations")
      .select("id")
      .eq("coach_id", coachId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (next) {
      await supabase
        .from("coach_locations")
        .update({ is_primary: true })
        .eq("id", next.id)
        .eq("coach_id", coachId);
    }
  }

  revalidateCoachLocationPaths(coachId);
  return { ok: true, message: "Location removed." };
}
