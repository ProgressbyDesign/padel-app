import "server-only";

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AdminAccount = {
  id: string;
  email: string;
  fullName: string | null;
};

/**
 * Operational admin gate: verified claims + profiles.role = "admin".
 * Does not use ADMIN_SECRET or user_metadata.
 */
export async function getAdminAccount(): Promise<AdminAccount | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = claims?.sub;
  if (error || typeof userId !== "string" || !userId) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile || profile.role !== "admin") return null;

  return {
    id: userId,
    email: typeof claims.email === "string" ? claims.email : "",
    fullName:
      typeof profile.full_name === "string" ? profile.full_name.trim() || null : null,
  };
}

export async function requireAdminAccount(
  mode: "redirect" | "not-found" = "redirect"
): Promise<AdminAccount> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = claims?.sub;

  if (error || typeof userId !== "string" || !userId) {
    if (mode === "not-found") notFound();
    redirect(`/login?next=${encodeURIComponent("/admin")}`);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile || profile.role !== "admin") {
    notFound();
  }

  return {
    id: userId,
    email: typeof claims?.email === "string" ? claims.email : "",
    fullName:
      typeof profile.full_name === "string" ? profile.full_name.trim() || null : null,
  };
}
