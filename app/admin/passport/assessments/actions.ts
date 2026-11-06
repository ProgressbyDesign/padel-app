"use server";
import { revalidatePath } from "next/cache";
import { getAdminAccount } from "@/lib/auth/adminSession";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { reviewClient } from "@/lib/passport/review/access";
export async function prepareAssessmentReminders() {
  const { client } = await reviewClient();
  if (!hasAdminPermission(await getAdminAccount(), "bookings.manage")) throw new Error("Administrator required.");
  const result = await client.rpc("passport_prepare_deadline_notifications");
  if (result.error) throw new Error("Reminder preparation is unavailable.");
  revalidatePath("/admin/passport/assessments");
}
