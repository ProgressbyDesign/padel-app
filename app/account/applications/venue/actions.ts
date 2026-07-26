"use server";

import { revalidatePath } from "next/cache";
import { isEditableVenueApplicationStatus } from "@/lib/venueProfileApplication/constants";
import type { VenueApplicationActionResult } from "@/lib/venueProfileApplication/types";
import {
  parseVenueChoicePayload,
  parseVenueRolePayload,
  validateVenueChoiceDraft,
  validateVenueChoiceForSubmit,
  validateVenueConfirmationDraft,
  validateVenueRoleDraft,
  validateVenueRoleForSubmit,
  type VenueChoiceInput,
  type VenueConfirmationInput,
  type VenueRoleInput,
} from "@/lib/venueProfileApplication/validation";
import {
  loadCurrentVenueApplication,
  loadOwnedEditableVenueApplication,
  loadOwnedVenueApplication,
  searchVenuesForApplication,
} from "@/lib/queries/venueProfileApplication";
import { createClient } from "@/lib/supabase/server";

function errorResult(
  message: string,
  fieldErrors: Record<string, string> = {}
): VenueApplicationActionResult {
  return { status: "error", message, fieldErrors };
}

function successResult(
  message: string,
  applicationId?: string
): VenueApplicationActionResult {
  return { status: "success", message, fieldErrors: {}, applicationId };
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

function revalidateVenueApplicationPaths() {
  revalidatePath("/account/applications");
  revalidatePath("/account/applications/venue");
  revalidatePath("/account");
  revalidatePath("/account/personal");
}

export async function createVenueApplicationDraft(): Promise<VenueApplicationActionResult> {
  const userId = await requireUserId();
  if (!userId) return errorResult("Sign in to start a venue application.");

  const existing = await loadCurrentVenueApplication();
  if (
    existing &&
    existing.application.status !== "declined" &&
    existing.application.status !== "withdrawn"
  ) {
    return successResult(
      "You already have a venue application in progress.",
      existing.application.id
    );
  }

  const applicantEmail = await claimsEmail();
  if (!applicantEmail) {
    return errorResult(
      "Your account email is required to start an application."
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("venue_profile_applications")
    .insert({
      user_id: userId,
      status: "draft",
      current_step: 1,
      applicant_email: applicantEmail,
    })
    .select("id")
    .single();

  if (error || !data) {
    return errorResult(
      "We could not start your venue application. Please try again shortly."
    );
  }

  revalidateVenueApplicationPaths();
  return successResult("Draft application created.", String(data.id));
}

export async function saveVenueApplicationRole(input: {
  applicationId: string;
  values: VenueRoleInput;
  nextStep?: number;
  exit?: boolean;
}): Promise<VenueApplicationActionResult> {
  const userId = await requireUserId();
  if (!userId) return errorResult("Sign in to save your application.");

  const application = await loadOwnedEditableVenueApplication(
    input.applicationId,
    userId
  );
  if (!application) {
    return errorResult("This application cannot be edited right now.");
  }

  const advancing = !input.exit && input.nextStep != null && input.nextStep > 1;
  const fieldErrors = advancing
    ? validateVenueRoleForSubmit(input.values)
    : validateVenueRoleDraft(input.values);
  if (Object.keys(fieldErrors).length > 0) {
    return errorResult("Fix the highlighted fields before continuing.", fieldErrors);
  }

  const payload = parseVenueRolePayload(input.values);
  const currentStep = Math.min(
    Math.max(input.nextStep ?? application.current_step, 1),
    4
  );

  const supabase = await createClient();
  const { error } = await supabase
    .from("venue_profile_applications")
    .update({
      relationship_to_venue: payload.relationship_to_venue,
      phone: payload.phone,
      current_step: currentStep,
    })
    .eq("id", application.id)
    .eq("user_id", userId);

  if (error) {
    return errorResult("We could not save your role details. Please try again.");
  }

  revalidateVenueApplicationPaths();
  return successResult(
    input.exit ? "Progress saved." : "Role details saved.",
    application.id
  );
}

export async function saveVenueApplicationVenue(input: {
  applicationId: string;
  values: VenueChoiceInput;
  nextStep?: number;
  exit?: boolean;
}): Promise<VenueApplicationActionResult> {
  const userId = await requireUserId();
  if (!userId) return errorResult("Sign in to save your application.");

  const application = await loadOwnedEditableVenueApplication(
    input.applicationId,
    userId
  );
  if (!application) {
    return errorResult("This application cannot be edited right now.");
  }

  const advancing = !input.exit && input.nextStep != null && input.nextStep > 2;
  const fieldErrors = advancing
    ? validateVenueChoiceForSubmit(input.values)
    : validateVenueChoiceDraft(input.values);
  if (Object.keys(fieldErrors).length > 0) {
    return errorResult("Fix the highlighted fields before continuing.", fieldErrors);
  }

  const payload = parseVenueChoicePayload(input.values);

  if (payload.application_mode === "claim_existing" && payload.target_venue_id) {
    const supabaseCheck = await createClient();
    const { data: venue } = await supabaseCheck
      .from("venues")
      .select("id")
      .eq("id", payload.target_venue_id)
      .maybeSingle();
    if (!venue) {
      return errorResult("Select a venue from the search results.", {
        target_venue_id: "Select a venue from the search results.",
      });
    }
  }

  const currentStep = Math.min(
    Math.max(input.nextStep ?? application.current_step, 1),
    4
  );

  const supabase = await createClient();
  const { error } = await supabase
    .from("venue_profile_applications")
    .update({
      application_mode: payload.application_mode,
      target_venue_id: payload.target_venue_id,
      proposed_venue_name: payload.proposed_venue_name,
      proposed_country: payload.proposed_country,
      proposed_city: payload.proposed_city,
      proposed_address: payload.proposed_address,
      proposed_website: payload.proposed_website,
      current_step: currentStep,
    })
    .eq("id", application.id)
    .eq("user_id", userId);

  if (error) {
    return errorResult("We could not save the venue details. Please try again.");
  }

  revalidateVenueApplicationPaths();
  return successResult(
    input.exit ? "Progress saved." : "Venue details saved.",
    application.id
  );
}

export async function saveVenueApplicationConfirmation(input: {
  applicationId: string;
  values: VenueConfirmationInput;
  nextStep?: number;
  exit?: boolean;
}): Promise<VenueApplicationActionResult> {
  const userId = await requireUserId();
  if (!userId) return errorResult("Sign in to save your application.");

  const application = await loadOwnedEditableVenueApplication(
    input.applicationId,
    userId
  );
  if (!application) {
    return errorResult("This application cannot be edited right now.");
  }

  const fieldErrors = validateVenueConfirmationDraft(input.values);
  if (Object.keys(fieldErrors).length > 0) {
    return errorResult("Fix the highlighted fields before continuing.", fieldErrors);
  }

  const currentStep = Math.min(
    Math.max(input.nextStep ?? application.current_step, 1),
    4
  );

  const supabase = await createClient();
  const { error } = await supabase
    .from("venue_profile_applications")
    .update({
      supporting_note: input.values.supporting_note.trim() || null,
      current_step: currentStep,
    })
    .eq("id", application.id)
    .eq("user_id", userId);

  if (error) {
    return errorResult("We could not save your confirmation. Please try again.");
  }

  revalidateVenueApplicationPaths();
  return successResult(
    input.exit ? "Progress saved." : "Confirmation saved.",
    application.id
  );
}

export async function setVenueApplicationStep(input: {
  applicationId: string;
  step: number;
}): Promise<VenueApplicationActionResult> {
  const userId = await requireUserId();
  if (!userId) return errorResult("Sign in to update your application.");

  const application = await loadOwnedEditableVenueApplication(
    input.applicationId,
    userId
  );
  if (!application) {
    return errorResult("This application cannot be edited right now.");
  }

  const step = Math.min(Math.max(Math.trunc(input.step), 1), 4);
  const supabase = await createClient();
  const { error } = await supabase
    .from("venue_profile_applications")
    .update({ current_step: step })
    .eq("id", application.id)
    .eq("user_id", userId);

  if (error) return errorResult("We could not update the application step.");

  revalidateVenueApplicationPaths();
  return successResult("Step updated.", application.id);
}

export async function submitVenueApplication(input: {
  applicationId: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
}): Promise<VenueApplicationActionResult> {
  const userId = await requireUserId();
  if (!userId) return errorResult("Sign in to submit your application.");

  const application = await loadOwnedVenueApplication(input.applicationId, userId);
  if (!application || !isEditableVenueApplicationStatus(application.status)) {
    return errorResult("This application cannot be submitted right now.");
  }

  const fieldErrors = {
    ...validateVenueRoleForSubmit({
      relationship_to_venue: application.relationship_to_venue ?? "",
      phone: application.phone ?? "",
    }),
    ...validateVenueChoiceForSubmit({
      application_mode: application.application_mode ?? "",
      target_venue_id: application.target_venue_id ?? "",
      proposed_venue_name: application.proposed_venue_name ?? "",
      proposed_country: application.proposed_country ?? "",
      proposed_city: application.proposed_city ?? "",
      proposed_address: application.proposed_address ?? "",
      proposed_website: application.proposed_website ?? "",
    }),
    ...validateVenueConfirmationDraft({
      supporting_note: application.supporting_note ?? "",
    }),
  };

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
    .from("venue_profile_applications")
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
    const { sendVenueApplicationStatusEmail } = await import(
      "@/lib/notifications/applicationEmails"
    );
    void sendVenueApplicationStatusEmail({
      to: email,
      status: "submitted",
      mode: application.application_mode,
      venueName:
        application.proposed_venue_name ||
        application.target_venue_id ||
        null,
    });
  }

  revalidateVenueApplicationPaths();
  return successResult("Application submitted for review.", application.id);
}

export async function withdrawVenueApplication(
  applicationId: string
): Promise<VenueApplicationActionResult> {
  const userId = await requireUserId();
  if (!userId) return errorResult("Sign in to withdraw your application.");

  const application = await loadOwnedVenueApplication(applicationId, userId);
  if (!application) return errorResult("Application not found.");

  if (
    application.status !== "draft" &&
    application.status !== "changes_requested" &&
    application.status !== "submitted" &&
    application.status !== "under_review"
  ) {
    return errorResult("This application can no longer be withdrawn.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("venue_profile_applications")
    .update({ status: "withdrawn" })
    .eq("id", application.id)
    .eq("user_id", userId);

  if (error) return errorResult("We could not withdraw the application.");

  revalidateVenueApplicationPaths();
  return successResult("Application withdrawn.", application.id);
}

export async function searchVenueApplicationTargets(
  term: string
): Promise<
  | {
      ok: true;
      venues: Awaited<ReturnType<typeof searchVenuesForApplication>>;
    }
  | { ok: false; message: string }
> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, message: "Sign in to search venues." };
  try {
    const venues = await searchVenuesForApplication(term);
    return { ok: true, venues };
  } catch {
    return { ok: false, message: "Venue search failed. Please try again." };
  }
}
