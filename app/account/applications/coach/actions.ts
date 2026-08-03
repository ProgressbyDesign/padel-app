"use server";

import { revalidatePath } from "next/cache";
import {
  isActiveApplicationStatus,
  isEditableApplicationStatus,
  isWithdrawableApplicationStatus,
  type CoachApplicationMode,
} from "@/lib/coachProfileApplication/constants";
import type {
  CoachApplicationActionResult,
  CoachClaimTargetSummary,
} from "@/lib/coachProfileApplication/types";
import { safeInternalPath } from "@/lib/auth/safePath";
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
  loadClaimTargetCoach,
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

async function claimsEmail(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email =
    typeof data?.claims?.email === "string" ? data.claims.email.trim() : "";
  return email || null;
}

function revalidateApplicationPaths(coachId?: string | null) {
  revalidatePath("/account/applications");
  revalidatePath("/account/applications/coach");
  revalidatePath("/account");
  revalidatePath("/account/personal");
  if (coachId) revalidatePath(`/coach/${coachId}`);
}

function mapInsertError(error: { code?: string; message?: string }): string {
  const message = error.message?.toLowerCase() ?? "";
  if (
    error.code === "23505" ||
    message.includes("duplicate") ||
    message.includes("unique")
  ) {
    return "You already have an application in progress.";
  }
  if (message.includes("claimed") || message.includes("target_coach")) {
    return "This profile is already claimed or no longer available.";
  }
  return "We could not start your application. Please try again shortly.";
}

export async function searchClaimableCoachesAction(
  term: string
): Promise<
  | { ok: true; coaches: CoachClaimTargetSummary[] }
  | { ok: false; message: string }
> {
  void term;
  return {
    ok: false,
    message:
      "Public profile claiming is no longer available. Apply as a coach to create a new profile.",
  };
}

export async function createCoachApplicationDraft(input?: {
  mode?: CoachApplicationMode | string;
  targetCoachId?: string | null;
}): Promise<CoachApplicationActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return errorResult("Sign in to start a coach application.");
  }

  const existing = await loadCurrentCoachApplication();
  if (existing && isActiveApplicationStatus(existing.application.status)) {
    return successResult(
      "You already have an application in progress.",
      existing.application.id
    );
  }

  const { loadLatestCoachApplication } = await import(
    "@/lib/queries/coachProfileApplication"
  );
  const latest = await loadLatestCoachApplication();
  if (latest?.application.status === "approved") {
    return errorResult(
      "Your coach application has already been approved. Contact support if you need another profile."
    );
  }

  if (
    input?.mode === "claim_existing" ||
    (typeof input?.targetCoachId === "string" &&
      input.targetCoachId.trim().length > 0)
  ) {
    return errorResult(
      "Public profile claiming is no longer available. Apply as a coach to create a new profile."
    );
  }

  // Self-service applications are create_new only; claim_existing is closed.
  const applicantEmail = await claimsEmail();
  if (!applicantEmail) {
    return errorResult(
      "Your account email is required to start an application."
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
      application_mode: "create_new",
      target_coach_id: null,
      applicant_email: applicantEmail,
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
    return errorResult(mapInsertError(error ?? {}));
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

  const advancing = !input.exit && input.nextStep != null && input.nextStep > 1;
  const fieldErrors = advancing
    ? validateStepOneForSubmit(input.values)
    : validateStepOneDraft(input.values);
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
    return errorResult("We could not save your details. Please try again.");
  }

  revalidateApplicationPaths(application.target_coach_id);
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

  const advancing = !input.exit && input.nextStep != null && input.nextStep > 3;
  const fieldErrors = advancing
    ? validateStepThreeForSubmit(input.values)
    : validateStepThreeDraft(input.values);
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
      "We could not save your coaching details. Please try again."
    );
  }

  revalidateApplicationPaths(application.target_coach_id);
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

  revalidateApplicationPaths(application.target_coach_id);
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

  if (
    application.application_mode === "claim_existing" &&
    application.target_coach_id
  ) {
    const stillClaimable = await loadClaimTargetCoach(
      application.target_coach_id
    );
    if (!stillClaimable) {
      return errorResult(
        "This profile is already claimed or no longer available."
      );
    }
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
    fieldErrors.locations =
      "Add at least one coaching location before submitting.";
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
  const applicantEmail = await claimsEmail();
  const { error } = await supabase
    .from("coach_profile_applications")
    .update({
      status: "submitted",
      current_step: 4,
      terms_accepted_at: now,
      privacy_accepted_at: now,
      ...(applicantEmail ? { applicant_email: applicantEmail } : {}),
    })
    .eq("id", application.id)
    .eq("user_id", userId);

  if (error) {
    return errorResult(
      "We could not submit your application. Please try again shortly."
    );
  }

  const email = (applicantEmail || application.applicant_email || "").trim();
  if (email) {
    const { sendCoachApplicationStatusEmail } = await import(
      "@/lib/notifications/applicationEmails"
    );
    void sendCoachApplicationStatusEmail({
      to: email,
      status: "submitted",
      mode: application.application_mode,
      coachName: application.full_name,
    });
  }

  revalidateApplicationPaths(application.target_coach_id);
  return successResult("Application submitted for review.", application.id);
}

export async function withdrawCoachApplication(
  applicationId: string,
  options?: { next?: string | null }
): Promise<CoachApplicationActionResult> {
  const userId = await requireUserId();
  if (!userId) return errorResult("Sign in to withdraw your application.");

  const application = await loadOwnedApplication(applicationId, userId);
  if (!application) {
    return errorResult("Application not found.");
  }

  if (!isWithdrawableApplicationStatus(application.status)) {
    return errorResult(
      application.status === "approved"
        ? "Approved applications cannot be withdrawn."
        : "This application can no longer be withdrawn."
    );
  }

  const previousStatus = application.status;
  const supabase = await createClient();
  const claimsMail = await claimsEmail();
  const applicantEmail =
    application.applicant_email?.trim() || claimsMail || "";

  const { error } = await supabase
    .from("coach_profile_applications")
    .update({
      status: "withdrawn",
    })
    .eq("id", application.id)
    .eq("user_id", userId)
    .in("status", [
      "draft",
      "submitted",
      "under_review",
      "changes_requested",
    ]);

  if (error) {
    return errorResult("We could not withdraw the application.");
  }

  revalidateApplicationPaths(application.target_coach_id);

  const { sendCoachApplicationWithdrawnEmails } = await import(
    "@/lib/notifications/applicationEmails"
  );
  void sendCoachApplicationWithdrawnEmails({
    applicantEmail,
    previousStatus,
    mode: application.application_mode,
    coachName: application.full_name,
  });

  const nextPath = safeInternalPath(
    options?.next,
    "/account/applications/coach"
  );

  return {
    status: "success",
    message: "Application withdrawn.",
    fieldErrors: {},
    applicationId: application.id,
    redirectTo: nextPath,
  };
}
