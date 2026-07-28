"use server";

import { revalidatePath } from "next/cache";
import { requireAdminPermission, type AdminAccount } from "@/lib/auth/adminSession";
import type {
  CoachApplicationMode,
  CoachApplicationStatus,
} from "@/lib/coachProfileApplication/constants";
import { isCoachApplicationMode } from "@/lib/coachProfileApplication/constants";
import {
  searchCoachesForAdminApproval,
  type AdminCoachSearchResult,
} from "@/lib/admin/applicationQueries";
import { writeAdminAuditEvent } from "@/lib/admin/audit";
import { logSkippedRecipient } from "@/lib/notifications/resolveRecipientEmail";
import { createClient } from "@/lib/supabase/server";

export type AdminApplicationActionResult = {
  ok: boolean;
  message: string;
  entityId?: string;
};

type CoachApplicationMutationRow = {
  id: string;
  user_id: string;
  status: CoachApplicationStatus;
  application_mode: CoachApplicationMode;
  target_coach_id: string | null;
  applicant_email: string | null;
  full_name: string | null;
  phone: string | null;
  coaching_role: string | null;
  coaching_role_other: string | null;
  experience_years: number | null;
  description: string | null;
  coach_id: string | null;
};

async function authorizeAdminAction(): Promise<AdminAccount> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || typeof data?.claims?.sub !== "string") {
    throw new Error("Your admin session has expired.");
  }
  return requireAdminPermission("applications.review", "not-found");
}

async function loadApplication(
  applicationId: string
): Promise<CoachApplicationMutationRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_profile_applications")
    .select(
      "id, user_id, status, application_mode, target_coach_id, applicant_email, full_name, phone, coaching_role, coaching_role_other, experience_years, description, coach_id"
    )
    .eq("id", applicationId)
    .maybeSingle();
  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[admin] load coach application failed:", error.message);
    }
    throw new Error("Unable to load application.");
  }
  if (!data) return null;
  const modeRaw = data.application_mode;
  return {
    ...(data as Omit<CoachApplicationMutationRow, "application_mode">),
    application_mode: isCoachApplicationMode(modeRaw) ? modeRaw : "create_new",
    target_coach_id: (data.target_coach_id as string | null) ?? null,
    coach_id: (data.coach_id as string | null) ?? null,
  };
}

function revalidateCoachApplication(applicationId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/applications");
  revalidatePath("/admin/applications/coaches");
  revalidatePath(`/admin/applications/coaches/${applicationId}`);
  revalidatePath("/account");
  revalidatePath("/account/personal");
  revalidatePath("/account/applications");
  revalidatePath("/account/applications/coach");
}

function canReview(status: CoachApplicationStatus): boolean {
  return status === "submitted" || status === "under_review";
}

function cleanNote(note: string): string | null {
  const value = note.trim();
  return value.length > 0 && value.length <= 2000 ? value : null;
}

async function notifyApplicant(input: {
  application: CoachApplicationMutationRow;
  status: "changes_requested" | "approved" | "declined";
  note?: string | null;
  coachName?: string | null;
}) {
  const email = input.application.applicant_email?.trim() || "";
  if (!email) {
    logSkippedRecipient("application-email", "no reliable applicant email", {
      applicationId: input.application.id,
      userId: input.application.user_id,
    });
    return;
  }
  const { sendCoachApplicationStatusEmail } = await import(
    "@/lib/notifications/applicationEmails"
  );
  void sendCoachApplicationStatusEmail({
    to: email,
    status: input.status,
    mode: input.application.application_mode,
    coachName: input.coachName ?? input.application.full_name,
    note: input.note,
  });
}

export async function startCoachApplicationReview(
  applicationId: string
): Promise<AdminApplicationActionResult> {
  await authorizeAdminAction();
  const application = await loadApplication(applicationId);
  if (!application) return { ok: false, message: "Application not found." };
  if (application.status !== "submitted") {
    return { ok: false, message: "Only submitted applications can enter review." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_profile_applications")
    .update({ status: "under_review", review_note: null })
    .eq("id", applicationId)
    .eq("status", "submitted")
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, message: "The application could not be moved into review." };
  }
  revalidateCoachApplication(applicationId);
  return { ok: true, message: "Review started." };
}

export async function requestCoachApplicationChanges(
  applicationId: string,
  note: string
): Promise<AdminApplicationActionResult> {
  await authorizeAdminAction();
  const reviewNote = cleanNote(note);
  if (!reviewNote) {
    return { ok: false, message: "A review note between 1 and 2,000 characters is required." };
  }
  const application = await loadApplication(applicationId);
  if (!application) return { ok: false, message: "Application not found." };
  if (!canReview(application.status)) {
    return { ok: false, message: "This application cannot have changes requested." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_profile_applications")
    .update({ status: "changes_requested", review_note: reviewNote })
    .eq("id", applicationId)
    .in("status", ["submitted", "under_review"])
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, message: "The change request could not be saved." };
  }
  revalidateCoachApplication(applicationId);
  void notifyApplicant({
    application,
    status: "changes_requested",
    note: reviewNote,
  });
  void writeAdminAuditEvent({
    action: "coach_application.changes_requested",
    targetType: "coach_profile_application",
    targetId: applicationId,
    details: {},
  }).catch(() => undefined);
  return { ok: true, message: "Changes requested." };
}

export async function declineCoachApplication(
  applicationId: string,
  note: string
): Promise<AdminApplicationActionResult> {
  await authorizeAdminAction();
  const reviewNote = cleanNote(note);
  if (!reviewNote) {
    return { ok: false, message: "A decline note between 1 and 2,000 characters is required." };
  }
  const application = await loadApplication(applicationId);
  if (!application) return { ok: false, message: "Application not found." };
  if (!canReview(application.status)) {
    return { ok: false, message: "This application cannot be declined from its current status." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_profile_applications")
    .update({ status: "declined", review_note: reviewNote })
    .eq("id", applicationId)
    .in("status", ["submitted", "under_review"])
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, message: "The application could not be declined." };
  }
  revalidateCoachApplication(applicationId);
  void notifyApplicant({
    application,
    status: "declined",
    note: reviewNote,
  });
  void writeAdminAuditEvent({
    action: "coach_application.declined",
    targetType: "coach_profile_application",
    targetId: applicationId,
    details: {},
  }).catch(() => undefined);
  return { ok: true, message: "Application declined." };
}

async function approveWithCoachId(
  application: CoachApplicationMutationRow,
  coachId: string
): Promise<AdminApplicationActionResult> {
  if (!canReview(application.status)) {
    return { ok: false, message: "This application cannot be approved from its current status." };
  }
  if (!coachId.trim()) return { ok: false, message: "Select a coach profile." };

  const supabase = await createClient();
  const { data: coach, error: coachError } = await supabase
    .from("coaches")
    .select("id, name, is_claimed")
    .eq("id", coachId)
    .maybeSingle();
  if (coachError || !coach) return { ok: false, message: "Selected coach was not found." };

  if (application.application_mode === "claim_existing" && coach.is_claimed) {
    return {
      ok: false,
      message:
        "This profile has already been claimed. Approval is disabled until the claim target is corrected.",
    };
  }

  const { data, error } = await supabase
    .from("coach_profile_applications")
    .update({ status: "approved", review_note: null, coach_id: coachId })
    .eq("id", application.id)
    .in("status", ["submitted", "under_review"])
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, message: "The application could not be approved." };
  }
  revalidateCoachApplication(application.id);
  void notifyApplicant({
    application: { ...application, coach_id: coachId },
    status: "approved",
    coachName: (coach.name as string | null) ?? application.full_name,
  });
  void writeAdminAuditEvent({
    action: "coach_application.approved",
    targetType: "coach_profile_application",
    targetId: application.id,
    details: { coachId },
  }).catch(() => undefined);
  return { ok: true, message: "Application approved.", entityId: coachId };
}

export async function approveCoachClaim(
  applicationId: string
): Promise<AdminApplicationActionResult> {
  await authorizeAdminAction();
  const application = await loadApplication(applicationId);
  if (!application || application.application_mode !== "claim_existing") {
    return { ok: false, message: "This is not a valid coach profile claim." };
  }
  if (!application.target_coach_id) {
    return { ok: false, message: "The claimed coach profile is missing." };
  }
  return approveWithCoachId(application, application.target_coach_id);
}

export async function approveCoachApplicationWithExisting(
  applicationId: string,
  coachId: string
): Promise<AdminApplicationActionResult> {
  await authorizeAdminAction();
  const application = await loadApplication(applicationId);
  if (!application) return { ok: false, message: "Application not found." };
  if (application.application_mode === "claim_existing") {
    return {
      ok: false,
      message: "Use Approve claim for profile claim applications.",
    };
  }
  return approveWithCoachId(application, coachId);
}

export async function createAndApproveCoachApplication(input: {
  applicationId: string;
  name: string;
  role: string;
  description: string;
  experienceYears: number | null;
  phone: string;
}): Promise<AdminApplicationActionResult> {
  const admin = await authorizeAdminAction();
  const application = await loadApplication(input.applicationId);
  if (!application) return { ok: false, message: "Application not found." };
  if (application.application_mode === "claim_existing") {
    return {
      ok: false,
      message: "Claims must bind to the existing target coach — do not create a new profile.",
    };
  }
  if (!canReview(application.status)) {
    return { ok: false, message: "This application cannot be approved from its current status." };
  }

  const name = input.name.trim();
  const role = input.role.trim();
  const description = input.description.trim();
  const phone = input.phone.trim();
  if (name.length < 2 || name.length > 120) {
    return { ok: false, message: "Coach name must be between 2 and 120 characters." };
  }
  if (
    input.experienceYears !== null &&
    (!Number.isInteger(input.experienceYears) ||
      input.experienceYears < 0 ||
      input.experienceYears > 60)
  ) {
    return { ok: false, message: "Experience must be a whole number between 0 and 60." };
  }

  const supabase = await createClient();
  const { data: duplicate, error: duplicateError } = await supabase
    .from("coaches")
    .select("id, name")
    .ilike("name", name)
    .limit(3);
  if (duplicateError) return { ok: false, message: "Duplicate check failed." };
  if ((duplicate ?? []).length > 0) {
    return {
      ok: false,
      message: `A coach named “${duplicate?.[0]?.name ?? name}” already exists. Search and select that profile instead.`,
      entityId: String(duplicate?.[0]?.id),
    };
  }

  const now = new Date().toISOString();
  const reviewedBy = admin.fullName || admin.email || admin.id;
  const { data: created, error: createError } = await supabase
    .from("coaches")
    .insert({
      name,
      role: role || null,
      description: description || null,
      experience_years: input.experienceYears,
      phone: phone || null,
      source: "application",
      is_approved: true,
      data_quality_status: "approved",
      reviewed_at: now,
      reviewed_by: reviewedBy,
    })
    .select("id")
    .single();
  if (createError || !created) {
    return { ok: false, message: "The coach profile could not be created." };
  }

  const coachId = String(created.id);
  const { data: approved, error: approveError } = await supabase
    .from("coach_profile_applications")
    .update({ status: "approved", review_note: null, coach_id: coachId })
    .eq("id", input.applicationId)
    .in("status", ["submitted", "under_review"])
    .select("id")
    .maybeSingle();
  if (approveError || !approved) {
    revalidateCoachApplication(input.applicationId);
    return {
      ok: false,
      message:
        "The coach was created, but the application was not approved. Select the new coach in the existing-profile approval section.",
      entityId: coachId,
    };
  }

  revalidateCoachApplication(input.applicationId);
  void notifyApplicant({
    application: { ...application, coach_id: coachId },
    status: "approved",
    coachName: name,
  });
  void writeAdminAuditEvent({
    action: "coach_application.approved",
    targetType: "coach_profile_application",
    targetId: input.applicationId,
    details: { coachId, created: true },
  }).catch(() => undefined);
  return { ok: true, message: "Coach created and application approved.", entityId: coachId };
}

export async function searchCoachesForApprovalAction(
  term: string
): Promise<{ ok: true; coaches: AdminCoachSearchResult[] } | { ok: false; message: string }> {
  await authorizeAdminAction();
  try {
    return { ok: true, coaches: await searchCoachesForAdminApproval(term) };
  } catch {
    return { ok: false, message: "Coach search failed." };
  }
}
