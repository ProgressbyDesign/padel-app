"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canReviewBooking, validateReviewInput } from "@/lib/coachReviews";

export async function submitCoachReview(input: unknown): Promise<{ ok: boolean; message: string }> {
  const parsed = validateReviewInput(input);
  if (!parsed.ok) return parsed;
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (authError || typeof userId !== "string") return { ok: false, message: "Please sign in to review your session." };
  const { data: booking, error } = await supabase.from("coach_booking_requests").select("coach_id, requester_user_id, status, ends_at").eq("id", parsed.bookingId).maybeSingle();
  if (error || !booking || !canReviewBooking(booking, userId)) return { ok: false, message: "You can only review your own completed session." };
  const { error: insertError } = await supabase.from("coach_reviews").insert({
    booking_id: parsed.bookingId,
    ...parsed.scores,
    body: parsed.body,
  });
  if (insertError) {
    if (insertError.code === "23505") return { ok: false, message: "You have already reviewed this session. Refresh the page to see your review." };
    if (insertError.code === "42501") return { ok: false, message: "This booking is not eligible for a player review. You cannot review a coach profile you manage." };
    console.error("[coach-reviews] submission failed", insertError.code);
    return { ok: false, message: "Your review could not be saved. Please try again." };
  }
  for (const path of ["/", "/coaches", `/coach/${booking.coach_id}`, `/account/bookings/${parsed.bookingId}`, "/account/bookings", "/api/coaches/top-rated"]) revalidatePath(path);
  return { ok: true, message: "Thank you. Your verified session review has been published." };
}
