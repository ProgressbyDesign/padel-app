"use server";

import { revalidatePath } from "next/cache";
import { requireAdminAccount, type AdminAccount } from "@/lib/auth/adminSession";
import {
  searchVenuesForAdminApproval,
  type AdminVenueSearchResult,
} from "@/lib/admin/applicationQueries";
import { createClient } from "@/lib/supabase/server";
import type {
  ApprovedMembershipRole,
  VenueApplicationStatus,
} from "@/lib/venueProfileApplication/constants";
import type { AdminApplicationActionResult } from "./coach-actions";

type VenueApplicationMutationRow = {
  id: string;
  user_id: string;
  status: VenueApplicationStatus;
  application_mode: "claim_existing" | "create_new" | null;
  relationship_to_venue: "owner" | "manager" | "authorised_representative" | null;
  target_venue_id: string | null;
  proposed_venue_name: string | null;
  proposed_country: string | null;
  proposed_city: string | null;
  proposed_address: string | null;
  proposed_website: string | null;
  phone: string | null;
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
): Promise<VenueApplicationMutationRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("venue_profile_applications")
    .select(
      "id, user_id, status, application_mode, relationship_to_venue, target_venue_id, proposed_venue_name, proposed_country, proposed_city, proposed_address, proposed_website, phone"
    )
    .eq("id", applicationId)
    .maybeSingle();
  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[admin] load venue application failed:", error.message);
    }
    throw new Error("Unable to load application.");
  }
  return (data as VenueApplicationMutationRow | null) ?? null;
}

function revalidateVenueApplication(applicationId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/applications");
  revalidatePath("/admin/applications/venues");
  revalidatePath(`/admin/applications/venues/${applicationId}`);
  revalidatePath("/account");
  revalidatePath("/account/applications");
  revalidatePath("/account/applications/venue");
}

function canReview(status: VenueApplicationStatus): boolean {
  return status === "submitted" || status === "under_review";
}

function cleanNote(note: string): string | null {
  const value = note.trim();
  return value.length > 0 && value.length <= 2000 ? value : null;
}

function validRole(role: string): role is ApprovedMembershipRole {
  return role === "owner" || role === "manager";
}

export async function startVenueApplicationReview(
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
    .from("venue_profile_applications")
    .update({ status: "under_review", review_note: null })
    .eq("id", applicationId)
    .eq("status", "submitted")
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, message: "The application could not be moved into review." };
  }
  revalidateVenueApplication(applicationId);
  return { ok: true, message: "Review started." };
}

export async function requestVenueApplicationChanges(
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
    .from("venue_profile_applications")
    .update({ status: "changes_requested", review_note: reviewNote })
    .eq("id", applicationId)
    .in("status", ["submitted", "under_review"])
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, message: "The change request could not be saved." };
  revalidateVenueApplication(applicationId);
  return { ok: true, message: "Changes requested." };
}

export async function declineVenueApplication(
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
    .from("venue_profile_applications")
    .update({ status: "declined", review_note: reviewNote })
    .eq("id", applicationId)
    .in("status", ["submitted", "under_review"])
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, message: "The application could not be declined." };
  revalidateVenueApplication(applicationId);
  return { ok: true, message: "Application declined." };
}

async function approveWithVenue(
  applicationId: string,
  venueId: string,
  membershipRole: ApprovedMembershipRole
): Promise<AdminApplicationActionResult> {
  const application = await loadApplication(applicationId);
  if (!application) return { ok: false, message: "Application not found." };
  if (!canReview(application.status)) {
    return { ok: false, message: "This application cannot be approved from its current status." };
  }
  const supabase = await createClient();
  const { data: venue, error: venueError } = await supabase
    .from("venues")
    .select("id")
    .eq("id", venueId)
    .maybeSingle();
  if (venueError || !venue) return { ok: false, message: "Selected venue was not found." };

  const { data, error } = await supabase
    .from("venue_profile_applications")
    .update({
      status: "approved",
      review_note: null,
      approved_venue_id: venueId,
      approved_membership_role: membershipRole,
    })
    .eq("id", applicationId)
    .in("status", ["submitted", "under_review"])
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, message: "The application could not be approved." };
  revalidateVenueApplication(applicationId);
  return { ok: true, message: "Application approved.", entityId: venueId };
}

export async function approveVenueClaim(input: {
  applicationId: string;
  membershipRole: string;
}): Promise<AdminApplicationActionResult> {
  await authorizeAdminAction();
  if (!validRole(input.membershipRole)) {
    return { ok: false, message: "Select an owner or manager membership role." };
  }
  const application = await loadApplication(input.applicationId);
  if (!application || application.application_mode !== "claim_existing") {
    return { ok: false, message: "This is not a valid venue claim." };
  }
  if (!application.target_venue_id) {
    return { ok: false, message: "The claimed venue is missing." };
  }
  return approveWithVenue(
    input.applicationId,
    application.target_venue_id,
    input.membershipRole
  );
}

export async function approveVenueApplicationWithExisting(input: {
  applicationId: string;
  venueId: string;
  membershipRole: string;
}): Promise<AdminApplicationActionResult> {
  await authorizeAdminAction();
  if (!validRole(input.membershipRole)) {
    return { ok: false, message: "Select an owner or manager membership role." };
  }
  if (!input.venueId.trim()) return { ok: false, message: "Select a venue." };
  return approveWithVenue(input.applicationId, input.venueId, input.membershipRole);
}

export async function createAndApproveVenueApplication(input: {
  applicationId: string;
  name: string;
  country: string;
  city: string;
  address: string;
  website: string;
  phone: string;
  membershipRole: string;
}): Promise<AdminApplicationActionResult> {
  const admin = await authorizeAdminAction();
  if (!validRole(input.membershipRole)) {
    return { ok: false, message: "Select an owner or manager membership role." };
  }
  const application = await loadApplication(input.applicationId);
  if (!application || application.application_mode !== "create_new") {
    return { ok: false, message: "This is not a valid new-venue application." };
  }
  if (!canReview(application.status)) {
    return { ok: false, message: "This application cannot be approved from its current status." };
  }

  const name = input.name.trim();
  const country = input.country.trim();
  const city = input.city.trim();
  const address = input.address.trim();
  const website = input.website.trim();
  const phone = input.phone.trim();
  if (name.length < 2 || name.length > 160) {
    return { ok: false, message: "Venue name must be between 2 and 160 characters." };
  }
  if (!country || !city) {
    return { ok: false, message: "Country and city are required." };
  }

  const supabase = await createClient();
  const { data: duplicate, error: duplicateError } = await supabase
    .from("venues")
    .select("id, name, city, country")
    .ilike("name", name)
    .limit(3);
  if (duplicateError) return { ok: false, message: "Duplicate check failed." };
  if ((duplicate ?? []).length > 0) {
    return {
      ok: false,
      message: `A venue named “${duplicate?.[0]?.name ?? name}” already exists. Search and approve using that venue instead.`,
      entityId: String(duplicate?.[0]?.id),
    };
  }

  const now = new Date().toISOString();
  const reviewedBy = admin.fullName || admin.email || admin.id;
  const { data: created, error: createError } = await supabase
    .from("venues")
    .insert({
      name,
      country,
      city,
      address: address || null,
      website: website || null,
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
    return { ok: false, message: "The venue could not be created." };
  }

  const venueId = String(created.id);
  const { data: approved, error: approveError } = await supabase
    .from("venue_profile_applications")
    .update({
      status: "approved",
      review_note: null,
      approved_venue_id: venueId,
      approved_membership_role: input.membershipRole,
    })
    .eq("id", input.applicationId)
    .in("status", ["submitted", "under_review"])
    .select("id")
    .maybeSingle();
  if (approveError || !approved) {
    revalidateVenueApplication(input.applicationId);
    return {
      ok: false,
      message:
        "The venue was created, but the application was not approved. Select the new venue in the existing-match section.",
      entityId: venueId,
    };
  }
  revalidateVenueApplication(input.applicationId);
  return { ok: true, message: "Venue created and application approved.", entityId: venueId };
}

export async function searchVenuesForApprovalAction(
  term: string
): Promise<{ ok: true; venues: AdminVenueSearchResult[] } | { ok: false; message: string }> {
  await authorizeAdminAction();
  try {
    return { ok: true, venues: await searchVenuesForAdminApproval(term) };
  } catch {
    return { ok: false, message: "Venue search failed." };
  }
}
