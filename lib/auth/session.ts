import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AuthenticatedAccount } from "./types";

export async function getAuthenticatedAccount(): Promise<AuthenticatedAccount | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) return null;

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
  };
}

export async function requireAuthenticatedAccount(
  requestedPath = "/account"
): Promise<AuthenticatedAccount> {
  const account = await getAuthenticatedAccount();
  if (!account) {
    redirect(`/login?next=${encodeURIComponent(requestedPath)}`);
  }
  return account;
}
