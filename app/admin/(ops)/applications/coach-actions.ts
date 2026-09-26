"use server";

import { revalidatePath } from "next/cache";
import { requireAdminPermission, type AdminAccount } from "@/lib/auth/adminSession";
import type {
  CoachApplicationMode,
  CoachApplicationStatus,
} from "@/lib/coachProfileApplication/constants";
import {
  coachingRoleLabel,
  isCoachApplicationMode,
} from "@/lib/coachProfileApplication/constants";
import { findPossibleDuplicateCoaches } from "@/lib/admin/applicationQueries";
import type { DuplicateCoachCandidate } from "@/lib/admin/coachDuplicates";
import {
  coachApprovalOutcomeMessage,
  POSSIBLE_DUPLICATE_MESSAGE,
} from "@/lib/admin/coachApprovalCopy";
import { writeAdminAuditEvent } from "@/lib/admin/audit";
import { logApplicationMutationFailure } from "@/lib/applications/mutationDiagnostics";
import { loadApplicationLocations } from "@/lib/queries/coachProfileApplication";
import { logSkippedRecipient } from "@/lib/notifications/resolveRecipientEmail";
import { createClient } from "@/lib/supabase/server";

export type AdminApplicationActionResult = {
  ok: boolean;
  message: string;
  entityId?: string;
  /**
   * Present when approval paused because existing coach profiles may belong
   * to the applicant. The admin must choose "Use existing profile" or
   * "Create separate coach"; nothing has been written yet.
   */
  duplicateCandidates?: DuplicateCoachCandidate[];
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

const REVIEWABLE_STATUSES: readonly CoachApplicationStatus[] = [
  "submitted",
  "under_review",
];

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

function revalidateCoachApplication(applicationId: string, coachId?: string) {
  if (coachId) {
    revalidatePath(`/coach/${coachId}`);
    revalidatePath(`/account/coaches/${coachId}`);
    revalidatePath("/coaches");
    revalidatePath("/");
    revalidatePath("/admin/coaches");
  }
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
  return REVIEWABLE_STATUSES.includes(status);
}

function cleanNote(note: string): string | null {
  const value = note.trim();
  return value.length > 0 && value.length <= 2000 ? value : null;
}

/** Role text seeded onto a coach profile, mirroring the approval trigger. */
function applicationRoleLabel(application: CoachApplicationMutationRow): string | null {
  if (!application.coaching_role) return null;
  if (application.coaching_role === "other") {
    return application.coaching_role_other?.trim() || null;
  }
  return coachingRoleLabel(application.coaching_role);
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
  await sendCoachApplicationStatusEmail({
    to: email,
    status: input.status,
    mode: input.application.application_mode,
    coachName: input.coachName ?? input.application.full_name,
    note: input.note,
  });
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
    .in("status", [...REVIEWABLE_STATUSES])
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, message: "The change request could not be saved." };
  }
  revalidateCoachApplication(applicationId);
  await notifyApplicant({
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
    .in("status", [...REVIEWABLE_STATUSES])
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, message: "The application could not be declined." };
  }
  revalidateCoachApplication(applicationId);
  await notifyApplicant({
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

async function readCoachPublicationStatus(coachId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("coaches")
    .select("publication_status")
    .eq("id", coachId)
    .maybeSingle();
  const value = data?.publication_status;
  return typeof value === "string" ? value : null;
}

/**
 * Final step shared by every approval path: bind the coach, mark approved,
 * then let the database trigger grant membership and seed the profile.
 * Emails, revalidation and the audit event are unchanged from before.
 */
async function finalizeApproval(
  admin: AdminAccount,
  application: CoachApplicationMutationRow,
  coach: { id: string; name: string | null },
  auditDetails: Record<string, unknown>
): Promise<AdminApplicationActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_profile_applications")
    .update({ status: "approved", review_note: null, coach_id: coach.id })
    .eq("id", application.id)
    .in("status", [...REVIEWABLE_STATUSES])
    .select("id")
    .maybeSingle();
  if (error || !data) {
    if (error) {
      logApplicationMutationFailure(
        "approveCoachApplication",
        { applicationId: application.id, userId: admin.id },
        error
      );
    }
    return { ok: false, message: "The application could not be approved." };
  }

  revalidateCoachApplication(application.id, coach.id);
  await notifyApplicant({
    application: { ...application, coach_id: coach.id },
    status: "approved",
    coachName: coach.name ?? application.full_name,
  });
  void writeAdminAuditEvent({
    action: "coach_application.approved",
    targetType: "coach_profile_application",
    targetId: application.id,
    details: { coachId: coach.id, ...auditDetails },
  }).catch(() => undefined);

  const publicationStatus = await readCoachPublicationStatus(coach.id);
  return {
    ok: true,
    message: coachApprovalOutcomeMessage(publicationStatus),
    entityId: coach.id,
  };
}

async function approveWithCoachId(
  admin: AdminAccount,
  application: CoachApplicationMutationRow,
  coachId: string,
  auditDetails: Record<string, unknown>
): Promise<AdminApplicationActionResult> {
  if (!canReview(application.status)) {
    return { ok: false, message: "This application cannot be approved from its current status." };
  }
  await requireAdminPermission("profiles.manage", "not-found");
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

  if (application.application_mode === "create_new") {
    // Never attach an applicant to a profile another account already manages.
    const { data: otherMembers, error: membershipError } = await supabase
      .from("coach_memberships")
      .select("user_id")
      .eq("coach_id", coachId)
      .neq("user_id", application.user_id)
      .limit(1);
    if (membershipError) {
      return { ok: false, message: "Unable to check who manages this coach profile." };
    }
    if ((otherMembers ?? []).length > 0) {
      return {
        ok: false,
        message:
          "This coach profile is already managed by another account. Create a separate coach instead, or resolve the existing account first.",
      };
    }
  }

  return finalizeApproval(
    admin,
    application,
    { id: String(coach.id), name: (coach.name as string | null) ?? null },
    auditDetails
  );
}

/** Historical profile claims: bind to the claimed target coach only. */
export async function approveCoachClaim(
  applicationId: string
): Promise<AdminApplicationActionResult> {
  const admin = await authorizeAdminAction();
  const application = await loadApplication(applicationId);
  if (!application || application.application_mode !== "claim_existing") {
    return { ok: false, message: "This is not a valid coach profile claim." };
  }
  if (!application.target_coach_id) {
    return { ok: false, message: "The claimed coach profile is missing." };
  }
  return approveWithCoachId(admin, application, application.target_coach_id, {
    claim: true,
  });
}

/**
 * "Use existing profile" after duplicate detection: approve the application
 * against a coach profile that already exists. Existing profile content is
 * preserved; membership is granted by the database trigger.
 */
export async function approveCoachApplicationWithExisting(
  applicationId: string,
  coachId: string
): Promise<AdminApplicationActionResult> {
  const admin = await authorizeAdminAction();
  const application = await loadApplication(applicationId);
  if (!application) return { ok: false, message: "Application not found." };
  if (application.application_mode === "claim_existing") {
    return {
      ok: false,
      message: "Use Approve claim for profile claim applications.",
    };
  }
  return approveWithCoachId(admin, application, coachId, {
    created: false,
    existingProfile: true,
  });
}

/**
 * Standard approval for `create_new` applications.
 *
 * Runs duplicate detection first. If existing coaches may match, nothing is
 * written and the candidates are returned for the admin to resolve. Otherwise
 * (or when `createSeparateCoach` is set) a coach is created from the
 * application data and the application is approved.
 */
export async function approveCoachApplication(
  applicationId: string,
  options?: { createSeparateCoach?: boolean }
): Promise<AdminApplicationActionResult> {
  const admin = await authorizeAdminAction();
  await requireAdminPermission("profiles.manage", "not-found");
  const application = await loadApplication(applicationId);
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

  const name = application.full_name?.trim() ?? "";
  if (name.length < 2 || name.length > 120) {
    return { ok: false, message: "Coach name must be between 2 and 120 characters." };
  }
  if (
    application.experience_years !== null &&
    (!Number.isInteger(application.experience_years) ||
      application.experience_years < 0 ||
      application.experience_years > 60)
  ) {
    return { ok: false, message: "Experience must be a whole number between 0 and 60." };
  }

  const createSeparateCoach = Boolean(options?.createSeparateCoach);
  const roleLabel = applicationRoleLabel(application);

  if (!createSeparateCoach) {
    const locations = await loadApplicationLocations(application.id);
    const candidates = await findPossibleDuplicateCoaches({
      applicantUserId: application.user_id,
      fullName: name,
      roleLabel,
      locations,
    });
    if (candidates.length > 0) {
      return {
        ok: false,
        message: POSSIBLE_DUPLICATE_MESSAGE,
        duplicateCandidates: candidates,
      };
    }
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const reviewedBy = admin.fullName || admin.email || admin.id;
  const { data: created, error: createError } = await supabase
    .from("coaches")
    .insert({
      name,
      role: roleLabel,
      description: application.description?.trim() || null,
      experience_years: application.experience_years,
      phone: application.phone?.trim() || null,
      source: "application",
      is_approved: true,
      data_quality_status: "approved",
      reviewed_at: now,
      reviewed_by: reviewedBy,
    })
    .select("id")
    .single();
  if (createError || !created) {
    if (createError) {
      logApplicationMutationFailure(
        "approveCoachApplication.createCoach",
        { applicationId: application.id, userId: admin.id },
        createError
      );
    }
    return { ok: false, message: "The coach profile could not be created." };
  }

  const coachId = String(created.id);
  const result = await finalizeApproval(admin, application, { id: coachId, name }, {
    created: true,
    ...(createSeparateCoach ? { duplicateOverride: true } : {}),
  });
  if (!result.ok) {
    revalidateCoachApplication(application.id);
    return {
      ok: false,
      message:
        "The coach profile was created but the application could not be approved. Choose Approve coach again and select the newly created profile.",
      entityId: coachId,
    };
  }
  return result;
}
