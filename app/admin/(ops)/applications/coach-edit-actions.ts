"use server";

import { revalidatePath } from "next/cache";
import { accountHasPermission, getAdminAccount } from "@/lib/auth/adminSession";
import { createClient } from "@/lib/supabase/server";
import {
  canEditCoachApplication,
  type CoachApplicationEditResult,
} from "@/lib/admin/coachApplicationEditing";
import {
  parseStepOnePayload,
  parseStepThreePayload,
  validateLocations,
  validateStepOneForSubmit,
  validateStepThreeForSubmit,
  type StepOneInput,
  type StepThreeInput,
} from "@/lib/coachProfileApplication/validation";
import type { CoachApplicationLocationInput } from "@/lib/coachProfileApplication/types";

type EditVersion = { applicationId: string; updatedAt: string };
const conflictMessage =
  "This application has changed. Cancel this edit and reload the application before trying again.";
const failure = (message: string): CoachApplicationEditResult => ({
  ok: false,
  message,
});

async function authorizeEdit(input: EditVersion) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || typeof data?.claims?.sub !== "string") return null;
  const admin = await getAdminAccount();
  if (
    !admin ||
    admin.id !== data.claims.sub ||
    !accountHasPermission(admin, "applications.review")
  )
    return null;
  const { data: application, error: loadError } = await supabase
    .from("coach_profile_applications")
    .select("id, status, updated_at")
    .eq("id", input.applicationId)
    .maybeSingle();
  if (loadError || !application || !canEditCoachApplication(application.status))
    return null;
  return { supabase, application };
}

// All RPCs run as the caller, use existing RLS and write to admin_audit_log in
// the SAME transaction as the edit. A failed audit cannot leave an unaudited edit.
async function saveCard(
  input: EditVersion,
  rpc:
    | "admin_update_coach_application_applicant"
    | "admin_update_coach_application_locations"
    | "admin_update_coach_application_profile",
  validate: () => Record<string, string>,
  payload: () => Record<string, unknown>,
): Promise<CoachApplicationEditResult> {
  try {
    const context = await authorizeEdit(input);
    if (!context)
      return failure(
        "You cannot edit this application. Check your access and its current status.",
      );
    if (context.application.updated_at !== input.updatedAt)
      return failure(conflictMessage);
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length)
      return {
        ok: false,
        message: "Check the highlighted fields.",
        fieldErrors,
      };
    const { error } = await context.supabase.rpc(rpc, {
      p_application_id: input.applicationId,
      p_expected_updated_at: input.updatedAt,
      ...payload(),
    });
    if (error) {
      if (error.code === "40001") return failure(conflictMessage);
      // Never log submitted field values, email, or database row details.
      console.error("[coach-application-edit]", {
        action: rpc,
        code: error.code,
      });
      return failure(
        "We could not save this card. Please try again or reload the application.",
      );
    }
    revalidatePath(`/admin/applications/coaches/${input.applicationId}`);
    revalidatePath("/admin/applications/coaches");
    revalidatePath("/account/applications/coach");
    return { ok: true, message: "Changes saved." };
  } catch {
    return failure(
      "We could not save this card. Check your session and try again.",
    );
  }
}

export async function updateCoachApplicationApplicantDetails(
  input: EditVersion & { details: StepOneInput },
): Promise<CoachApplicationEditResult> {
  return saveCard(
    input,
    "admin_update_coach_application_applicant",
    () => validateStepOneForSubmit(input.details),
    () => {
      const fields = parseStepOnePayload(input.details);
      return {
        p_full_name: fields.full_name,
        p_phone: fields.phone,
        p_coaching_role: fields.coaching_role,
        p_coaching_role_other: fields.coaching_role_other,
        p_experience_years: fields.experience_years,
      };
    },
  );
}

export async function updateCoachApplicationLocations(
  input: EditVersion & { locations: CoachApplicationLocationInput[] },
): Promise<CoachApplicationEditResult> {
  return saveCard(
    input,
    "admin_update_coach_application_locations",
    () => validateLocations(input.locations, { requireAtLeastOne: true }),
    () => ({
      p_locations: input.locations.map((location) => ({
        country: location.country.trim(),
        city: location.city.trim(),
        is_primary: location.is_primary,
      })),
    }),
  );
}

export async function updateCoachApplicationCoachingProfile(
  input: EditVersion & { profile: StepThreeInput },
): Promise<CoachApplicationEditResult> {
  return saveCard(
    input,
    "admin_update_coach_application_profile",
    () => validateStepThreeForSubmit(input.profile),
    () => {
      const fields = parseStepThreePayload(input.profile);
      return {
        p_description: fields.description,
        p_player_levels: fields.player_levels,
        p_audiences: fields.audiences,
        p_outcomes: fields.outcomes,
      };
    },
  );
}
