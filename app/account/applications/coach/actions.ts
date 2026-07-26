"use server";

import { revalidatePath } from "next/cache";
import {
  COACHING_OUTCOMES,
  isActiveApplicationStatus,
  isApplicationCountry,
  isCoachApplicationMode,
  isEditableApplicationStatus,
  isWithdrawableApplicationStatus,
  mapLegacyCoachRole,
  type AudienceValue,
  type CoachApplicationMode,
  type CoachingOutcomeValue,
  type PlayerLevelValue,
} from "@/lib/coachProfileApplication/constants";
import type { CoachApplicationActionResult } from "@/lib/coachProfileApplication/types";
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
  isValidCoachApplicationUuid,
  loadApplicationLocations,
  loadClaimTargetCoach,
  loadCurrentCoachApplication,
  loadOwnedApplication,
  loadOwnedEditableApplication,
  searchClaimableCoaches,
} from "@/lib/queries/coachProfileApplication";
import type { CoachClaimTargetSummary } from "@/lib/coachProfileApplication/types";
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

const OUTCOME_KEYS = new Set(
  COACHING_OUTCOMES.map((outcome) => outcome.value)
);

function asPlayerLevels(values: unknown): PlayerLevelValue[] {
  if (!Array.isArray(values)) return [];
  return values.filter(
    (value): value is PlayerLevelValue =>
      typeof value === "string" &&
      ["beginner", "intermediate", "advanced", "competitive_professional"].includes(
        value
      )
  );
}

function asAudiences(attrs: {
  audience_adults?: boolean | null;
  audience_juniors?: boolean | null;
}): AudienceValue[] {
  const audiences: AudienceValue[] = [];
  if (attrs.audience_adults) audiences.push("adults");
  if (attrs.audience_juniors) audiences.push("juniors");
  return audiences;
}

export async function searchClaimableCoachesAction(
  term: string
): Promise<
  | { ok: true; coaches: CoachClaimTargetSummary[] }
  | { ok: false; message: string }
> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, message: "Sign in to search coach profiles." };
  try {
    return { ok: true, coaches: await searchClaimableCoaches(term, userId) };
  } catch {
    return { ok: false, message: "Coach search failed. Please try again." };
  }
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

  const mode: CoachApplicationMode = isCoachApplicationMode(input?.mode)
    ? input.mode
    : "create_new";

  const applicantEmail = await claimsEmail();
  if (!applicantEmail) {
    return errorResult(
      "Your account email is required to start an application."
    );
  }

  const supabase = await createClient();

  if (mode === "create_new") {
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

  const targetCoachId = input?.targetCoachId?.trim() ?? "";
  if (!isValidCoachApplicationUuid(targetCoachId)) {
    return errorResult("Select a valid coach profile to claim.", {
      target_coach_id: "Select a coach from the search results.",
    });
  }

  const target = await loadClaimTargetCoach(targetCoachId);
  if (!target) {
    return errorResult(
      "This profile is already claimed or no longer available.",
      { target_coach_id: "Choose another unclaimed profile." }
    );
  }

  const [{ data: coachRow }, { data: attrs }, { data: outcomesRows }, { data: locRows }] =
    await Promise.all([
      supabase
        .from("coaches")
        .select("id, name, role, phone, experience_years, description")
        .eq("id", targetCoachId)
        .maybeSingle(),
      supabase
        .from("coach_attributes")
        .select("audience_adults, audience_juniors, player_levels")
        .eq("coach_id", targetCoachId)
        .maybeSingle(),
      supabase
        .from("coach_outcomes")
        .select("outcome_key, outcome")
        .eq("coach_id", targetCoachId),
      supabase
        .from("coach_locations")
        .select("country, city, is_primary")
        .eq("coach_id", targetCoachId)
        .order("is_primary", { ascending: false }),
    ]);

  if (!coachRow) {
    return errorResult("This profile is already claimed or no longer available.");
  }

  const mappedRole = mapLegacyCoachRole(coachRow.role as string | null);
  const playerLevels = asPlayerLevels(attrs?.player_levels);
  const audiences = asAudiences(attrs ?? {});
  const outcomes = (outcomesRows ?? [])
    .map((row) => row.outcome_key)
    .filter(
      (key): key is CoachingOutcomeValue =>
        typeof key === "string" && OUTCOME_KEYS.has(key as CoachingOutcomeValue)
    );

  const fullName =
    typeof coachRow.name === "string" ? coachRow.name.trim() : "";
  const phone =
    typeof coachRow.phone === "string" ? coachRow.phone.trim() : "";
  const description =
    typeof coachRow.description === "string"
      ? coachRow.description.trim()
      : "";

  const { data, error } = await supabase
    .from("coach_profile_applications")
    .insert({
      user_id: userId,
      status: "draft",
      current_step: 1,
      application_mode: "claim_existing",
      target_coach_id: targetCoachId,
      applicant_email: applicantEmail,
      full_name:
        fullName.length >= 2 && fullName.length <= 120 ? fullName : null,
      phone: phone.length >= 5 && phone.length <= 40 ? phone : null,
      coaching_role: mappedRole.coaching_role,
      coaching_role_other: mappedRole.coaching_role_other,
      experience_years:
        typeof coachRow.experience_years === "number"
          ? coachRow.experience_years
          : null,
      description:
        description.length >= 40 && description.length <= 500
          ? description
          : description.length > 500
            ? description.slice(0, 500)
            : null,
      player_levels: playerLevels,
      audiences,
      outcomes,
    })
    .select("id")
    .single();

  if (error || !data) {
    return errorResult(mapInsertError(error ?? {}));
  }

  const applicationId = String(data.id);
  const locationPayload = (locRows ?? [])
    .map((row, index) => {
      const country = String(row.country ?? "").trim();
      const city = String(row.city ?? "").trim();
      if (!isApplicationCountry(country) || city.length < 2) return null;
      return {
        application_id: applicationId,
        country,
        city: city.slice(0, 120),
        is_primary: Boolean(row.is_primary) || index === 0,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (locationPayload.length > 0) {
    const primaryIndex = locationPayload.findIndex((row) => row.is_primary);
    const normalized = locationPayload.map((row, index) => ({
      ...row,
      is_primary: primaryIndex >= 0 ? index === primaryIndex : index === 0,
    }));
    await supabase.from("coach_application_locations").insert(normalized);
  }

  revalidateApplicationPaths(targetCoachId);
  return successResult("Claim draft created.", applicationId);
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
