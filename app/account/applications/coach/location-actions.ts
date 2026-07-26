"use server";

import { revalidatePath } from "next/cache";
import type { CoachApplicationActionResult } from "@/lib/coachProfileApplication/types";
import type { CoachApplicationLocationInput } from "@/lib/coachProfileApplication/types";
import {
  normalizeLocationRows,
  validateLocations,
} from "@/lib/coachProfileApplication/validation";
import { loadOwnedEditableApplication } from "@/lib/queries/coachProfileApplication";
import { createClient } from "@/lib/supabase/server";

function errorResult(
  message: string,
  fieldErrors: Record<string, string> = {}
): CoachApplicationActionResult {
  return { status: "error", message, fieldErrors };
}

async function requireUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string" || !userId) return null;
  return userId;
}

function revalidateApplicationPaths() {
  revalidatePath("/account/applications");
  revalidatePath("/account/applications/coach");
  revalidatePath("/account");
  revalidatePath("/account/personal");
}

/**
 * Replace all locations for an editable application.
 * Saves application step first via caller; this only mutates location rows.
 */
export async function replaceCoachApplicationLocations(input: {
  applicationId: string;
  locations: CoachApplicationLocationInput[];
  nextStep?: number;
  exit?: boolean;
  requireAtLeastOne?: boolean;
}): Promise<CoachApplicationActionResult> {
  const userId = await requireUserId();
  if (!userId) return errorResult("Sign in to save locations.");

  const application = await loadOwnedEditableApplication(
    input.applicationId,
    userId
  );
  if (!application) {
    return errorResult("This application cannot be edited right now.");
  }

  const locations = normalizeLocationRows(input.locations);
  const advancing = !input.exit && input.nextStep != null && input.nextStep > 2;
  const fieldErrors = validateLocations(locations, {
    requireAtLeastOne:
      input.requireAtLeastOne ?? advancing,
  });
  if (Object.keys(fieldErrors).length > 0) {
    return errorResult("Fix the location fields before continuing.", fieldErrors);
  }

  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("coach_application_locations")
    .delete()
    .eq("application_id", application.id);

  if (deleteError) {
    return errorResult("We could not update your locations. Please try again.");
  }

  if (locations.length > 0) {
    const { error: insertError } = await supabase
      .from("coach_application_locations")
      .insert(
        locations.map((location) => ({
          application_id: application.id,
          country: location.country,
          city: location.city,
          is_primary: location.is_primary,
        }))
      );

    if (insertError) {
      return errorResult(
        "We could not save your locations. Check for duplicate city and country pairs."
      );
    }
  }

  const currentStep = Math.min(
    Math.max(input.nextStep ?? application.current_step, 1),
    4
  );

  const { error: stepError } = await supabase
    .from("coach_profile_applications")
    .update({
      current_step: currentStep,
    })
    .eq("id", application.id)
    .eq("user_id", userId);

  if (stepError) {
    return errorResult("Locations may have saved, but the step could not be updated.");
  }

  revalidateApplicationPaths();
  return {
    status: "success",
    message: input.exit ? "Progress saved." : "Locations saved.",
    fieldErrors: {},
    applicationId: application.id,
  };
}
