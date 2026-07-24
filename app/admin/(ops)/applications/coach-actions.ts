"use server";

import { revalidatePath } from "next/cache";
import { requireAdminAccount, type AdminAccount } from "@/lib/auth/adminSession";
import type { CoachApplicationStatus } from "@/lib/coachProfileApplication/constants";
import {
  searchCoachesForAdminApproval,
  type AdminCoachSearchResult,
} from "@/lib/admin/applicationQueries";
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
  full_name: string | null;
  phone: string | null;
  coaching_role: string | null;
  coaching_role_other: string | null;
  experience_years: number | null;
  description: string | null;
};

async function authorizeAdminAction(): Promise<AdminAccount> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || typeof data?.claims?.sub !== "string") {
    throw new Error("Your admin session has expired.");
  }
  return requireAdminAccount("not-found");
}

async function loadApplication(
  applicationId: string
): Promise<CoachApplicationMutationRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_profile_applications")
    .select(
      "id, user_id, status, full_name, phone, coaching_role, coaching_role_other, experience_years, description"
    )
    .eq("id", applicationId)
    .maybeSingle();
  if (error) throw new Error(`Unable to load application: ${error.message}`);
  return (data as CoachApplicationMutationRow | null) ?? null;
}

function revalidateCoachApplication(applicationId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/applications");
  revalidatePath("/admin/applications/coaches");
  revalidatePath(`/admin/applications/coaches/${applicationId}`);
  revalidatePath("/account");
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
  return { ok: true, message: "Application declined." };
}

export async function approveCoachApplicationWithExisting(
  applicationId: string,
  coachId: string
): Promise<AdminApplicationActionResult> {
  await authorizeAdminAction();
  const application = await loadApplication(applicationId);
  if (!application) return { ok: false, message: "Application not found." };
  if (!canReview(application.status)) {
    return { ok: false, message: "This application cannot be approved from its current status." };
  }
  if (!coachId.trim()) return { ok: false, message: "Select a coach profile." };

  const supabase = await createClient();
  const { data: coach, error: coachError } = await supabase
    .from("coaches")
    .select("id")
    .eq("id", coachId)
    .maybeSingle();
  if (coachError || !coach) return { ok: false, message: "Selected coach was not found." };

  const { data, error } = await supabase
    .from("coach_profile_applications")
    .update({ status: "approved", review_note: null, coach_id: coachId })
    .eq("id", applicationId)
    .in("status", ["submitted", "under_review"])
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, message: "The application could not be approved." };
  }
  revalidateCoachApplication(applicationId);
  return { ok: true, message: "Application approved.", entityId: coachId };
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
