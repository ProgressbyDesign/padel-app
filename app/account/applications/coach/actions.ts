"use server";

import { revalidatePath } from "next/cache";
import {
  isEditableApplicationStatus,
} from "@/lib/coachProfileApplication/constants";
import type { CoachApplicationActionResult } from "@/lib/coachProfileApplication/types";
import {
  parseStepOnePayload,
  parseStepThreePayload,
  validateStepOneDraft,
  validateStepOneForSubmit,
  validateStepThreeDraft,
  validateStepThreeForSubmit,
  type StepOneInput,
  type StepThreeInput,
} from "@/lib/coachProfileApplication/validation";
import {
  loadApplicationLocations,
  loadCurrentCoachApplication,
  loadOwnedApplication,
  loadOwnedEditableApplication,
} from "@/lib/queries/coachProfileApplication";
import { createClient } from "@/lib/supabase/server";

function errorResult(
  message: string,
  fieldErrors: Record<string, string> = {}
): CoachApplicationActionResult {
  return { status: "error", message, fieldErrors };
}

function successResult(
  message: string,
  applicationId?: string
): CoachApplicationActionResult {
  return {
    status: "success",
    message,
    fieldErrors: {},
    applicationId,
  };
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
}

function safeMutationMessage(fallback: string): string {
  return fallback;
}

export async function createCoachApplicationDraft(): Promise<CoachApplicationActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return errorResult("Sign in to start a coach application.");
  }

  const existing = await loadCurrentCoachApplication();
  if (
    existing &&
    existing.application.status !== "declined" &&
    existing.application.status !== "withdrawn"
  ) {
    return successResult(
      "You already have an application in progress.",
      existing.application.id
    );
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  const prefillName =
    typeof profile?.full_name === "string" ? profile.full_name.trim() : "";

  const { data, error } = await supabase
    .from("coach_profile_applications")
    .insert({
      user_id: userId,
      status: "draft",
      current_step: 1,
      full_name:
        prefillName.length >= 2 && prefillName.length <= 120
          ? prefillName
          : null,
      player_levels: [],
      audiences: [],
      outcomes: [],
    })
    .select("id")
    .single();

  if (error || !data) {
    return errorResult(
      safeMutationMessage(
        "We could not start your application. Please try again shortly."
      )
    );
  }

  revalidateApplicationPaths();
  return successResult("Draft application created.", String(data.id));
}

export async function saveCoachApplicationStepOne(input: {
  applicationId: string;
  values: StepOneInput;
  nextStep?: number;
  exit?: boolean;
}): Promise<CoachApplicationActionResult> {
  const userId = await requireUserId();
  if (!userId) return errorResult("Sign in to save your application.");

  const application = await loadOwnedEditableApplication(
    input.applicationId,
    userId
  );
  if (!application) {
    return errorResult("This application cannot be edited right now.");
  }

  const fieldErrors = validateStepOneDraft(input.values);
  if (Object.keys(fieldErrors).length > 0) {
    return errorResult("Fix the highlighted fields before continuing.", fieldErrors);
  }

  const payload = parseStepOnePayload(input.values);
  const currentStep = Math.min(
    Math.max(input.nextStep ?? application.current_step, 1),
    4
  );

  const supabase = await createClient();
  const { error } = await supabase
    .from("coach_profile_applications")
    .update({
      full_name: payload.full_name,
      phone: payload.phone,
      coaching_role: payload.coaching_role,
      coaching_role_other: payload.coaching_role_other,
      experience_years: payload.experience_years,
      current_step: currentStep,
    })
    .eq("id", application.id)
    .eq("user_id", userId);

  if (error) {
    return errorResult(
      safeMutationMessage("We could not save your details. Please try again.")
    );
  }

  revalidateApplicationPaths();
  return successResult(
    input.exit ? "Progress saved." : "About you saved.",
    application.id
  );
}

export async function saveCoachApplicationStepThree(input: {
  applicationId: string;
  values: StepThreeInput;
  nextStep?: number;
  exit?: boolean;
}): Promise<CoachApplicationActionResult> {
  const userId = await requireUserId();
  if (!userId) return errorResult("Sign in to save your application.");

  const application = await loadOwnedEditableApplication(
    input.applicationId,
    userId
  );
  if (!application) {
    return errorResult("This application cannot be edited right now.");
  }

  const fieldErrors = validateStepThreeDraft(input.values);
  if (Object.keys(fieldErrors).length > 0) {
    return errorResult("Fix the highlighted fields before continuing.", fieldErrors);
  }

  const payload = parseStepThreePayload(input.values);
  const currentStep = Math.min(
    Math.max(input.nextStep ?? application.current_step, 1),
    4
  );

  const supabase = await createClient();
  const { error } = await supabase
    .from("coach_profile_applications")
    .update({
      player_levels: payload.player_levels,
      audiences: payload.audiences,
      outcomes: payload.outcomes,
      description: payload.description,
      current_step: currentStep,
    })
    .eq("id", application.id)
    .eq("user_id", userId);

  if (error) {
    return errorResult(
      safeMutationMessage("We could not save your coaching details. Please try again.")
    );
  }

  revalidateApplicationPaths();
  return successResult(
    input.exit ? "Progress saved." : "Coaching details saved.",
    application.id
  );
}

export async function setCoachApplicationStep(input: {
  applicationId: string;
  step: number;
}): Promise<CoachApplicationActionResult> {
  const userId = await requireUserId();
  if (!userId) return errorResult("Sign in to update your application.");

  const application = await loadOwnedEditableApplication(
    input.applicationId,
    userId
  );
  if (!application) {
    return errorResult("This application cannot be edited right now.");
  }

  const step = Math.min(Math.max(Math.trunc(input.step), 1), 4);
  const supabase = await createClient();
  const { error } = await supabase
    .from("coach_profile_applications")
    .update({
      current_step: step,
    })
    .eq("id", application.id)
    .eq("user_id", userId);

  if (error) {
    return errorResult("We could not update the application step.");
  }

  revalidateApplicationPaths();
  return successResult("Step updated.", application.id);
}

export async function submitCoachApplication(input: {
  applicationId: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
}): Promise<CoachApplicationActionResult> {
  const userId = await requireUserId();
  if (!userId) return errorResult("Sign in to submit your application.");

  const application = await loadOwnedApplication(input.applicationId, userId);
  if (!application || !isEditableApplicationStatus(application.status)) {
    return errorResult("This application cannot be submitted right now.");
  }

  const stepOneErrors = validateStepOneForSubmit({
    full_name: application.full_name ?? "",
    phone: application.phone ?? "",
    coaching_role: application.coaching_role ?? "",
    coaching_role_other: application.coaching_role_other ?? "",
    experience_years:
      application.experience_years === null
        ? ""
        : String(application.experience_years),
  });

  const stepThreeErrors = validateStepThreeForSubmit({
    player_levels: application.player_levels,
    audiences: application.audiences,
    outcomes: application.outcomes,
    description: application.description ?? "",
  });

  const locations = await loadApplicationLocations(application.id);
  const fieldErrors = { ...stepOneErrors, ...stepThreeErrors };
  if (locations.length === 0) {
    fieldErrors.locations = "Add at least one coaching location before submitting.";
  }
  if (!input.termsAccepted) {
    fieldErrors.terms = "Confirm that the information is accurate.";
  }
  if (!input.privacyAccepted) {
    fieldErrors.privacy = "Agree to the partner terms and privacy policy.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return errorResult(
      "Complete the required fields before submitting.",
      fieldErrors
    );
  }

  const now = new Date().toISOString();
  const supabase = await createClient();
  // Column-level UPDATE grants cover status/terms/privacy/step — not submitted_at/updated_at.
  const { error } = await supabase
    .from("coach_profile_applications")
    .update({
      status: "submitted",
      current_step: 4,
      terms_accepted_at: now,
      privacy_accepted_at: now,
    })
    .eq("id", application.id)
    .eq("user_id", userId);

  if (error) {
    return errorResult(
      safeMutationMessage(
        "We could not submit your application. Please try again shortly."
      )
    );
  }

  revalidateApplicationPaths();
  return successResult("Application submitted for review.", application.id);
}

export async function withdrawCoachApplication(
  applicationId: string
): Promise<CoachApplicationActionResult> {
  const userId = await requireUserId();
  if (!userId) return errorResult("Sign in to withdraw your application.");

  const application = await loadOwnedApplication(applicationId, userId);
  if (!application) {
    return errorResult("Application not found.");
  }

  if (
    application.status !== "draft" &&
    application.status !== "changes_requested" &&
    application.status !== "submitted"
  ) {
    return errorResult("This application can no longer be withdrawn.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("coach_profile_applications")
    .update({
      status: "withdrawn",
    })
    .eq("id", application.id)
    .eq("user_id", userId);

  if (error) {
    return errorResult("We could not withdraw the application.");
  }

  revalidateApplicationPaths();
  return successResult("Application withdrawn.", application.id);
}
