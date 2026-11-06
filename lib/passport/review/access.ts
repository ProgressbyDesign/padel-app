import "server-only";
import { videoProviderMode } from "../video/localConfig";
import { createClient } from "@/lib/supabase/server";

export const validId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function reviewExperienceEnabled() { return videoProviderMode() !== null; }
export async function reviewClient() {
  if (!reviewExperienceEnabled()) throw new Error("Assessment review is unavailable.");
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) throw new Error("Sign in to continue.");
  return { client, userId: data.claims.sub as string };
}
