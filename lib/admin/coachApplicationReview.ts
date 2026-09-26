import "server-only";

import { accountHasPermission, getAdminAccount } from "@/lib/auth/adminSession";
import {
  COACH_APPLICATION_SELECT,
  coachApplication,
  type AdminCoachApplication,
} from "@/lib/admin/applicationQueries";
import { createClient } from "@/lib/supabase/server";

/**
 * Opening the full review page is the act of starting the review.
 *
 * Compare-and-set: only a row that is still `submitted` moves to
 * `under_review`, so two admins opening the same application (or one admin
 * refreshing) can never overwrite a later decision. Nothing is written when
 * the viewer lacks `applications.review` (RLS would refuse anyway) or when the
 * application is in any other status, so re-renders are naturally idempotent.
 *
 * Callers must only invoke this from the application detail page, never from
 * queues, previews or list rows.
 */
export async function beginCoachApplicationReviewOnOpen(
  application: AdminCoachApplication
): Promise<AdminCoachApplication> {
  if (application.status !== "submitted") return application;

  const account = await getAdminAccount();
  if (!accountHasPermission(account, "applications.review")) return application;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_profile_applications")
    .update({ status: "under_review" })
    .eq("id", application.id)
    .eq("status", "submitted")
    .select(COACH_APPLICATION_SELECT)
    .maybeSingle();

  if (!error && data) {
    return coachApplication(data as Record<string, unknown>);
  }

  // Another admin acted between our read and this write: show their state.
  const { data: current } = await supabase
    .from("coach_profile_applications")
    .select(COACH_APPLICATION_SELECT)
    .eq("id", application.id)
    .maybeSingle();
  return current ? coachApplication(current as Record<string, unknown>) : application;
}
