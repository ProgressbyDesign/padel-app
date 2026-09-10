"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
export async function savePlayerFavourites(_: {message: string}, form: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string") return {message:"Please sign in again."};
  const coach = String(form.get("coach") ?? "");
  const venue = String(form.get("venue") ?? "");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if ((coach && !uuid.test(coach)) || (venue && !uuid.test(venue))) return {message:"Choose a coach and club from the list."};
  const { error: saveError } = await supabase.from("player_favourites").upsert({user_id:userId,coach_id:coach || null,venue_id:venue || null});
  if (saveError) return {message:"Your favourites could not be saved. Please refresh and try again."};
  revalidatePath("/account/personal");
  return {message:"Your favourites are saved."};
}
